import express, { Application, Request, Response, NextFunction } from 'express';
import * as expressWs from 'express-ws';
import * as sqlite3 from 'sqlite3';
import { OnvifDevice, Discovery } from 'node-onvif'; // Import specific classes
import { WebSocket } from 'ws';

// Extend the Express Application type to include the 'ws' property from express-ws
interface WsApplication extends Application {
	ws: ExpressWsMethod;
}

// Define a type for the express-ws method
type ExpressWsMethod = (
	route: string,
	callback: (ws: WebSocket, req: Request) => void
) => void;

const app: WsApplication = express() as any;
const port: number = 3000;

expressWs.default(app); // Extend express app with websockets

app.use(express.json());

// CORS for frontend
app.use((req: Request, res: Response, next: NextFunction) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header(
		'Access-Control-Allow-Headers',
		'Origin, X-Requested-With, Content-Type, Accept'
	);
	res.header('Access-Control-Allow-Methods', '*');
	next();
});

// Utility function to wait for a given number of milliseconds
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Initialize SQLite database
const db = new sqlite3.Database('./camview.db', (err: Error | null) => {
	if (err) {
		console.error('Error opening database:', err.message);
	} else {
		console.log('Connected to the SQLite database.');
		db.run(
			`CREATE TABLE IF NOT EXISTS cameras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            rtspUrl TEXT NOT NULL,
            onvifUrl TEXT,
            username TEXT,
            password TEXT
        )`,
			(err: Error | null) => {
				if (err) {
					console.error('Error creating cameras table:', err.message);
				} else {
					console.log('Cameras table created or already exists.');
				}
			}
		);
	}
});

// API Endpoints
app.get('/', (req: Request, res: Response) => {
	res.send('Camview Backend is running!');
});

interface CameraRequestBody {
	name: string;
	host: string;
	username?: string;
	password?: string;
}

interface CameraUpdateRequestBody {
	name: string;
	rtspUrl: string;
	onvifUrl?: string;
	username?: string;
	password?: string;
}

interface CameraDbRow {
	id: number;
	name: string;
	rtspUrl: string;
	onvifUrl: string;
	username: string;
	password?: string;
}

// Updated OnvifDevice interface to match node-onvif's OnvifDevice
interface OnvifDeviceInstance {
	urn: string;
	name: string;
	xaddrs: string[];
	ptz: any;
	init(): Promise<void>;
	getStreamUri(options: { protocol: 'RTSP' }): Promise<{ uri: string }>;
	ptzMove(options: {
		speed: { x?: number; y?: number; z?: number };
		timeout?: number;
	}): Promise<void>;
	ptzStop(): Promise<void>;
}

// Add a new camera
app.post(
	'/api/cameras',
	async (req: Request<{}, {}, CameraRequestBody>, res: Response) => {
		const { name, host, username, password } = req.body;
		if (!name || !host) {
			return res.status(400).json({ error: 'Name and Host are required.' });
		}

		try {
			console.log(`Attempting to connect to ONVIF device at host: ${host}`);
			const device = new OnvifDevice({
				xaddr: `http://${host}:8899/onvif/device_service`, // Assuming a common ONVIF port and path
				user: username,
				pass: password,
			});

			await device.init();
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
app.put(
	'/api/cameras/:id',
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
app.get('/api/cameras', (req: Request, res: Response) => {
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
app.delete(
	'/api/cameras/:id',
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
app.get('/api/onvif/discover', async (req: Request, res: Response) => {
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
app.post(
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

				const { onvifUrl, username, password } = camera;
				const { command, speed } = req.body;

				if (!onvifUrl || !username || !password) {
					return res.status(400).json({
						error:
							'Camera details (ONVIF URL, username, password) are required for control.',
					});
				}

				try {
					const device = new OnvifDevice({
						xaddr: onvifUrl,
						user: username,
						pass: password,
					});

					await device.init(); // Initialize the device
					console.log('CONNECTED to camera for PTZ control:', onvifUrl);

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

// WebSocket for camera streaming (placeholder for now)
app.ws('/api/camera/:id/stream', (ws: WebSocket, req: Request) => {
	const cameraId: string = req.params.id;
	console.log(`WebSocket connection established for camera ${cameraId}`);

	ws.on('message', (msg: string) => {
		console.log(`Received message for camera ${cameraId}: ${msg}`);
		// Here you would typically forward this message to the camera or a streaming process
	});

	ws.on('close', () => {
		console.log(`WebSocket connection closed for camera ${cameraId}`);
	});

	ws.on('error', (error: Error) => {
		console.error(`WebSocket error for camera ${cameraId}:`, error);
	});
});

app.listen(port, () => {
	console.log(`Backend server listening at http://localhost:${port}`);
});
