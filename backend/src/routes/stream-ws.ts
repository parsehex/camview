import { Request } from 'express';
import { WebSocket } from 'ws';
import ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';
import { CameraDbRow } from '../types/camera';
import { db } from '../utils/db';

// WebSocket for camera streaming
// This needs to be handled by the express-ws instance directly, not the router.
// The server.ts will handle this.
export const cameraStreamWs = async (ws: WebSocket, req: Request) => {
	const cameraId: string = req.params.id;
	console.log(`WebSocket connection established for camera ${cameraId}`);

	// Fetch camera details from the database
	db.get<CameraDbRow>(
		`SELECT * FROM cameras WHERE id = ?`,
		[cameraId],
		async (err: Error | null, camera: CameraDbRow | undefined) => {
			if (err) {
				console.error('Error fetching camera details for streaming:', err);
				ws.send(JSON.stringify({ error: 'Failed to fetch camera details.' }));
				ws.close();
				return;
			}
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

			// Construct RTSP URL with credentials if available
			let rtspStreamUrl = rtspUrl;
			if (username && password) {
				const url = new URL(rtspUrl);
				url.username = username;
				url.password = password;
				rtspStreamUrl = url.toString();
			}

			console.log(`Attempting to stream from RTSP URL: ${rtspStreamUrl}`);

			const ffmpegCommand = ffmpeg(rtspStreamUrl)
				.inputOptions([
					'-rtsp_transport',
					'tcp', // Use TCP for RTSP
					'-buffer_size',
					'1024000', // Increase buffer size
				])
				.outputOptions([
					'-f',
					'mjpeg', // Output format as MJPEG
					'-q:v',
					'5', // Video quality (1-31, 1 is best)
					'-r',
					'10', // Frame rate
					'-s',
					'640x480', // Resolution
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
					if (ws.readyState === WebSocket.OPEN) {
						ws.send(
							JSON.stringify({ error: `FFmpeg error: ${ffmpegErr.message}` })
						);
						ws.close();
					}
				})
				.on('end', () => {
					console.log(`FFmpeg process ended for camera ${cameraId}`);
					if (ws.readyState === WebSocket.OPEN) {
						ws.close();
					}
				});

			const stream = ffmpegCommand.pipe() as Readable;

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
	);
};
