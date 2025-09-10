import express, { Request, Response } from 'express';
import * as sqlite3 from 'sqlite3';
import { Discovery } from 'node-onvif';
import { WebSocket } from 'ws';
import ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';
import {
	CameraDbRow,
	CameraRequestBody,
	CameraUpdateRequestBody,
	OnvifDeviceInstance,
} from '../types/camera';
import { db } from '../utils/db';
import { getDevice } from '../utils/onvif';

const router = express.Router();

// Add a new camera
router.post(
	'/api/cameras',
	async (req: Request<{}, {}, CameraRequestBody>, res: Response) => {
		const { name, host, username, password } = req.body;
		if (!name || !host) {
			return res.status(400).json({ error: 'Name and Host are required.' });
		}

		try {
			console.log(`Attempting to connect to ONVIF device at host: ${host}`);
			const device = await getDevice(
				`http://${host}:8899/onvif/device_service`,
				username,
				password,
				'camera-' + name
			);
			console.log('CONNECTED to camera:', host);

			let discoveredRtspUrl: string;
			try {
				const { stream } = device.current_profile;
				discoveredRtspUrl = stream.rtsp;
			} catch (streamErr: any) {
				console.warn(
					`Could not get RTSP stream URI from ONVIF device at ${host}:`,
					streamErr.message
				);
				discoveredRtspUrl = `rtsp://${host}:554/stream`; // Fallback RTSP URL
			}

			const onvifUrl = device.services.ptz?.xaddr;

			db.run(
				`INSERT INTO cameras (name, rtspUrl, onvifUrl, username, password) VALUES (?, ?, ?, ?, ?)`,
				[name, discoveredRtspUrl, onvifUrl, username, password],
				function (this: sqlite3.RunResult, dbErr: Error | null) {
					if (dbErr) {
						return res.status(500).json({ error: dbErr.message });
					}
					res.status(201).json({
						id: this.lastID,
						name,
						rtspUrl: discoveredRtspUrl,
						onvifUrl,
						username,
						password,
					});
				}
			);
		} catch (error: any) {
			console.error('Error adding camera:', error);
			return res.status(500).json({
				error: `Failed to connect to camera or initialize: ${error.message}`,
			});
		}
	}
);

// Update a camera
router.put(
	'/api/cameras:id',
	(
		req: Request<{ id: string }, {}, CameraUpdateRequestBody>,
		res: Response
	) => {
		const { id } = req.params;
		const { name, rtspUrl, onvifUrl, username, password } = req.body;

		if (!name || !rtspUrl) {
			return res.status(400).json({ error: 'Name and RTSP URL are required.' });
		}

		db.run(
			`UPDATE cameras SET name = ?, rtspUrl = ?, onvifUrl = ?, username = ?, password = ? WHERE id = ?`,
			[name, rtspUrl, onvifUrl, username, password, id],
			function (this: sqlite3.RunResult, err: Error | null) {
				if (err) {
					return res.status(500).json({ error: err.message });
				}
				if (this.changes === 0) {
					return res.status(404).json({ error: 'Camera not found.' });
				}
				res.json({
					message: `Camera ${id} updated successfully.`,
					id,
					name,
					rtspUrl,
					onvifUrl,
					username,
					password,
				});
			}
		);
	}
);

// Get all cameras
router.get('/api/cameras', (req: Request, res: Response) => {
	db.all<CameraDbRow[]>(
		`SELECT * FROM cameras`,
		[],
		(err: Error | null, rows: CameraDbRow[][]) => {
			if (err) {
				return res.status(500).json({ error: err.message });
			}
			res.json(rows);
		}
	);
});

// Delete a camera
router.delete(
	'/api/cameras:id',
	(req: Request<{ id: string }>, res: Response) => {
		const { id } = req.params;

		db.run(
			`DELETE FROM cameras WHERE id = ?`,
			id,
			function (this: sqlite3.RunResult, err: Error | null) {
				if (err) {
					return res.status(500).json({ error: err.message });
				}
				if (this.changes === 0) {
					return res.status(404).json({ error: 'Camera not found.' });
				}
				res.json({ message: `Camera ${id} deleted successfully.` });
			}
		);
	}
);

// ONVIF Discovery
router.get('/api/onvif/discover', async (req: Request, res: Response) => {
	console.log('Starting ONVIF discovery...');
	const devices: OnvifDeviceInstance[] = []; // Use the updated interface
	Discovery.on('device', (device: OnvifDeviceInstance) => {
		console.log('Discovered ONVIF device:', device);
		devices.push({
			urn: device.urn,
			name: device.name,
			xaddrs: device.xaddrs,
			ptz: device.ptz,
			init: device.init,
			getStreamUri: device.getStreamUri,
			ptzMove: device.ptzMove,
			ptzStop: device.ptzStop,

			current_profile: device.current_profile,
			services: device.services,
		});
	});
	Discovery.probe();

	// Stop probing after a timeout (e.g., 5 seconds)
	setTimeout(() => {
		console.log('ONVIF discovery finished. Found devices:', devices.length);
		res.json(devices);
	}, 5000);
});

// ONVIF PTZ Control
router.post(
	'/api/onvif/control/:id',
	async (
		req: Request<{ id: string }, {}, { command: string; speed: number }>,
		res: Response
	) => {
		const cameraId = req.params.id;
		// Fetch camera details from the database
		db.get<CameraDbRow>(
			`SELECT * FROM cameras WHERE id = ?`,
			[cameraId],
			async (err: Error | null, camera: CameraDbRow | undefined) => {
				// Added async here
				if (err) {
					console.error('Error fetching camera details:', err);
					return res.status(500).json({ error: err.message });
				}
				if (!camera) {
					return res.status(404).json({ error: 'Camera not found.' });
				}

				const { name, onvifUrl, username, password } = camera;
				const { command, speed } = req.body;

				if (!onvifUrl) {
					return res.status(400).json({
						error: 'ONVIF URL is required for control.',
					});
				}

				try {
					const device = await getDevice(
						onvifUrl,
						username,
						password,
						'camera-' + name
					);

					let ptzSpeed: { x?: number; y?: number; z?: number };
					switch (command) {
						case 'moveUp':
							ptzSpeed = { y: speed };
							break;
						case 'moveDown':
							ptzSpeed = { y: -speed };
							break;
						case 'moveLeft':
							ptzSpeed = { x: -speed };
							break;
						case 'moveRight':
							ptzSpeed = { x: speed };
							break;
						case 'zoomIn':
							ptzSpeed = { z: speed };
							break;
						case 'zoomOut':
							ptzSpeed = { z: -speed };
							break;
						case 'stop':
							await device.ptzStop();
							return res.json({
								message: `PTZ stop command sent to camera ${cameraId}.`,
							});
						default:
							return res.status(400).json({ error: 'Invalid PTZ command.' });
					}

					await device.ptzMove({ speed: ptzSpeed });
					res.json({
						message: `PTZ ${command} command sent to camera ${cameraId}.`,
					});
				} catch (error: any) {
					console.error('Error sending PTZ command:', error);
					return res.status(500).json({
						error: `Failed to send PTZ command: ${error.message}`,
					});
				}
			}
		);
	}
);

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

export default router;
