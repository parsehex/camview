import { Request } from 'express';
import { WebSocket } from 'ws';
import ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';
import { CameraDbRow } from '../types/camera';
import { getAppSetting } from '../utils/db'; // Import getAppSetting
import { db } from '../utils/db';

// WebSocket for camera streaming
// This needs to be handled by the express-ws instance directly, not the router.
// The server.ts will handle this.

interface StreamCacheEntry {
	ffmpegCommand: ffmpeg.FfmpegCommand;
	stream: Readable;
	clients: Set<WebSocket>; // Use a Set to keep track of unique WebSocket clients
	lastAccessed: number; // Timestamp for potential future cleanup
	buffer: Buffer[];
}

const streamCache = new Map<string, StreamCacheEntry>();
const STREAM_INACTIVITY_TIMEOUT = 60 * 1000; // 60 seconds of inactivity before stream is killed

// Function to clean up inactive streams
const cleanupInactiveStreams = () => {
	const now = Date.now();
	for (const [cameraId, entry] of streamCache.entries()) {
		if (
			entry.clients.size === 0 &&
			now - entry.lastAccessed > STREAM_INACTIVITY_TIMEOUT
		) {
			console.log(`Cleaning up inactive stream for camera ${cameraId}`);
			entry.ffmpegCommand.kill('SIGKILL');
			streamCache.delete(cameraId);
		}
	}
};

// Run cleanup every minute
setInterval(cleanupInactiveStreams, 60 * 1000);

export const cameraStreamWs = async (ws: WebSocket, req: Request) => {
	const cameraId: string = req.params.id;
	console.log(`WebSocket connection established for camera ${cameraId}`);

	const keepStreamsOpenSetting = await getAppSetting('keep_streams_open');
	const keepStreamsOpen = keepStreamsOpenSetting === 'true';

	let streamEntry = streamCache.get(cameraId);

	if (keepStreamsOpen && streamEntry) {
		console.log(`Reusing existing stream for camera ${cameraId}`);
		streamEntry.clients.add(ws);
		streamEntry.lastAccessed = Date.now();

		streamEntry.buffer.forEach((chunk) => {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(chunk);
			}
		});

		ws.on('close', () => {
			console.log(`WebSocket connection closed for camera ${cameraId}.`);
			streamEntry?.clients.delete(ws);
			if (streamEntry && streamEntry.clients.size === 0) {
				streamEntry.lastAccessed = Date.now(); // Mark for potential cleanup
			}
		});

		ws.on('error', (error: Error) => {
			console.error(`WebSocket error for camera ${cameraId}:`, error);
			streamEntry?.clients.delete(ws);
			if (streamEntry && streamEntry.clients.size === 0) {
				streamEntry.lastAccessed = Date.now(); // Mark for potential cleanup
			}
		});

		return;
	}

	// If no existing stream or keepStreamsOpen is false, fetch camera details and start a new one
	try {
		const camera = db
			.prepare(`SELECT * FROM cameras WHERE id = ?`)
			.get(cameraId) as CameraDbRow | undefined;

		if (!camera) {
			ws.send(JSON.stringify({ error: 'Camera not found.' }));
			ws.close();
			return;
		}

		const { rtspUrl, username, password } = camera;

		if (!rtspUrl) {
			ws.send(
				JSON.stringify({ error: 'RTSP URL not available for this camera.' })
			);
			ws.close();
			return;
		}

		let rtspStreamUrl = rtspUrl;
		if (username && password) {
			const url = new URL(rtspUrl);
			url.username = username;
			url.password = password;
			rtspStreamUrl = url.toString();
		}

		console.log(
			`Attempting to start new stream for RTSP URL: ${rtspStreamUrl}`
		);

		const ffmpegCommand = ffmpeg(rtspStreamUrl)
			.inputOptions(['-rtsp_transport', 'tcp', '-buffer_size', '1024000'])
			.outputOptions([
				'-f',
				'mpegts',
				'-codec:v',
				'libx264',
				'-preset',
				'ultrafast',
				'-tune',
				'zerolatency',
				'-r',
				'25',
				'-s',
				'1280x720',
				'-b:v',
				'1000k',
				'-maxrate',
				'1000k',
				'-bufsize',
				'2000k',
				'-codec:a',
				'aac',
				'-b:a',
				'128k',
				'-ar',
				'44100',
				'-ac',
				'2',
			])
			.on('start', (commandLine) => {
				console.log('FFmpeg process started with command:', commandLine);
			})
			.on('codecData', (data) => {
				console.log('FFmpeg codec data:', data);
			})
			.on('error', (ffmpegErr, stdout, stderr) => {
				console.error(
					`FFmpeg error for camera ${cameraId}:`,
					ffmpegErr.message
				);
				console.error('FFmpeg stdout:', stdout);
				console.error('FFmpeg stderr:', stderr);

				const currentStreamEntry = streamCache.get(cameraId);
				if (currentStreamEntry) {
					currentStreamEntry.clients.forEach((clientWs) => {
						if (clientWs.readyState === WebSocket.OPEN) {
							clientWs.send(
								JSON.stringify({
									error: `FFmpeg error: ${ffmpegErr.message}`,
								})
							);
							clientWs.close();
						}
					});
					currentStreamEntry.ffmpegCommand.kill('SIGKILL');
					streamCache.delete(cameraId);
				} else if (ws.readyState === WebSocket.OPEN) {
					ws.send(
						JSON.stringify({ error: `FFmpeg error: ${ffmpegErr.message}` })
					);
					ws.close();
				}
			})
			.on('end', () => {
				console.log(`FFmpeg process ended for camera ${cameraId}`);
				const currentStreamEntry = streamCache.get(cameraId);
				if (currentStreamEntry) {
					currentStreamEntry.clients.forEach((clientWs) => {
						if (clientWs.readyState === WebSocket.OPEN) {
							clientWs.close();
						}
					});
					streamCache.delete(cameraId);
				} else if (ws.readyState === WebSocket.OPEN) {
					ws.close();
				}
			});

		const stream = ffmpegCommand.pipe() as Readable;

		if (keepStreamsOpen) {
			streamEntry = {
				ffmpegCommand,
				stream,
				clients: new Set([ws]),
				lastAccessed: Date.now(),
				buffer: [],
			};
			streamCache.set(cameraId, streamEntry);

			// This is the SINGLE data listener for the FFmpeg stream
			stream.on('data', (chunk: Buffer) => {
				if (streamEntry) {
					streamEntry.buffer.push(chunk);
					if (streamEntry.buffer.length > 500) {
						streamEntry.buffer.shift();
					}
				}

				streamEntry?.clients.forEach((clientWs) => {
					if (clientWs.readyState === WebSocket.OPEN) {
						clientWs.send(chunk);
					}
				});
			});

			ws.on('close', () => {
				console.log(`WebSocket connection closed for camera ${cameraId}.`);
				streamEntry?.clients.delete(ws);
				if (streamEntry && streamEntry.clients.size === 0) {
					streamEntry.lastAccessed = Date.now(); // Mark for potential cleanup
				}
			});

			ws.on('error', (error: Error) => {
				console.error(`WebSocket error for camera ${cameraId}:`, error);
				streamEntry?.clients.delete(ws);
				if (streamEntry && streamEntry.clients.size === 0) {
					streamEntry.lastAccessed = Date.now(); // Mark for potential cleanup
				}
			});
		} else {
			// Original behavior: no caching, pipe directly to current client
			stream.on('data', (chunk) => {
				if (ws.readyState === WebSocket.OPEN) {
					ws.send(chunk);
				}
			});

			ws.on('close', () => {
				console.log(
					`WebSocket connection closed for camera ${cameraId}. Stopping FFmpeg.`
				);
				ffmpegCommand.kill('SIGKILL'); // Ensure FFmpeg process is killed
			});

			ws.on('error', (error: Error) => {
				console.error(`WebSocket error for camera ${cameraId}:`, error);
				ffmpegCommand.kill('SIGKILL');
			});
		}
	} catch (err: any) {
		console.error('Error fetching camera details for streaming:', err);
		ws.send(JSON.stringify({ error: 'Failed to fetch camera details.' }));
		ws.close();
		return;
	}
};

export async function getFrameAsBase64(
	cameraId: string | number
): Promise<string> {
	return new Promise(async (resolve, reject) => {
		try {
			const camera = db
				.prepare(`SELECT * FROM cameras WHERE id = ?`)
				.get(cameraId) as CameraDbRow | undefined;

			if (!camera) {
				return reject(new Error('Camera not found.'));
			}

			const { rtspUrl, username, password } = camera;

			if (!rtspUrl) {
				return reject(new Error('RTSP URL not available for this camera.'));
			}

			let rtspStreamUrl = rtspUrl;
			if (username && password) {
				const url = new URL(rtspUrl);
				url.username = username;
				url.password = password;
				rtspStreamUrl = url.toString();
			}

			console.log(`Attempting to capture frame from: ${rtspStreamUrl}`);

			const buffers: Buffer[] = [];
			const ffmpegCommand = ffmpeg(rtspStreamUrl)
				.inputOptions(['-rtsp_transport', 'tcp'])
				.outputOptions([
					'-vframes',
					'1', // Capture only one frame
					'-f',
					'image2', // Output format as image
					'-c:v',
					'mjpeg', // Output codec
					'-q:v',
					'2', // Quality (1-31, 1 is best)
					'-s',
					'1280x720', // Resolution
				])
				.pipe() as Readable;

			ffmpegCommand.on('data', (chunk) => {
				buffers.push(chunk);
			});

			ffmpegCommand.on('end', () => {
				const imageBuffer = Buffer.concat(buffers);
				const base64Image = imageBuffer.toString('base64');
				console.log('Got frame');
				resolve(base64Image);
			});

			ffmpegCommand.on('error', (ffmpegErr: any, stdout: any, stderr: any) => {
				console.error('FFmpeg frame capture error:', ffmpegErr.message);
				console.error('FFmpeg stdout:', stdout);
				console.error('FFmpeg stderr:', stderr);
				reject(new Error(`FFmpeg frame capture failed: ${ffmpegErr.message}`));
			});
		} catch (err: any) {
			return reject(new Error('Failed to fetch camera details.'));
		}
	});
}

export async function getFramesAsBase64(
	cameraId: string | number,
	frameCount: number = 1,
	delayMs: number = 1000
): Promise<string[]> {
	const frames: string[] = [];

	for (let i = 0; i < frameCount; i++) {
		try {
			const frame = await getFrameAsBase64(cameraId);
			frames.push(frame);

			// Wait between frames if not the last frame
			if (i < frameCount - 1) {
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		} catch (error) {
			console.error(`Error capturing frame ${i + 1}:`, error);
			// Continue with available frames rather than failing completely
			if (frames.length === 0) {
				throw error; // Only throw if no frames were captured at all
			}
		}
	}

	return frames;
}
