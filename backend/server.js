const express = require('express');
const expressWs = require('express-ws');
const sqlite3 = require('sqlite3').verbose();
const onvif = require('onvif');
const app = express();
const port = 3000;

expressWs(app); // Extend express app with websockets

app.use(express.json());

// CORS for frontend
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
	res.header('Access-Control-Allow-Methods', '*');
	next();
});

// Initialize SQLite database
const db = new sqlite3.Database('./camview.db', (err) => {
	if (err) {
		console.error('Error opening database:', err.message);
	} else {
		console.log('Connected to the SQLite database.');
		db.run(`CREATE TABLE IF NOT EXISTS cameras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            rtspUrl TEXT NOT NULL,
            onvifUrl TEXT,
            username TEXT,
            password TEXT
        )`, (err) => {
			if (err) {
				console.error('Error creating cameras table:', err.message);
			} else {
				console.log('Cameras table created or already exists.');
			}
		});
	}
});

// API Endpoints
app.get('/', (req, res) => {
	res.send('Camview Backend is running!');
});

// Add a new camera
app.post('/api/cameras', (req, res) => { // Removed async
	const { name, host, username, password } = req.body; // Expecting 'host', 'username', 'password'
	if (!name || !host) {
		return res.status(400).json({ error: 'Name and Host are required.' });
	}

	try {
		console.log(`Attempting to connect to ONVIF device at host: ${host}`);
		new onvif.Cam({
			hostname: host,
			username: username,
			password: password,
			port: 80 // Default ONVIF port, can be made configurable if needed
		}, function (err, device) {
			if (err) {
				console.error('Connection Failed for ' + host + ' Username: ' + username + ' Password: ' + password, err);
				return res.status(500).json({ error: `Failed to connect to camera: ${err.message}` });
			}
			console.log('CONNECTED to camera:', host);

			// Get stream URI
			device.getStreamUri({ protocol: 'RTSP' }, function (err, stream) {
				if (err) {
					console.warn(`Could not get RTSP stream URI from ONVIF device at ${host}:`, err.message);
					// Fallback to default or user-provided if discovery fails
					let discoveredRtspUrl = `rtsp://${host}:554/stream`; // Default placeholder
					const onvifUrl = device.xaddrs[0]; // Assuming the first XAddr is the ONVIF URL
					db.run(`INSERT INTO cameras (name, rtspUrl, onvifUrl, username, password) VALUES (?, ?, ?, ?, ?)`,
						[name, discoveredRtspUrl, onvifUrl, username, password],
						function (dbErr) {
							if (dbErr) {
								return res.status(500).json({ error: dbErr.message });
							}
							res.status(201).json({ id: this.lastID, name, rtspUrl: discoveredRtspUrl, onvifUrl, username, password });
						});
					return;
				}

				const discoveredRtspUrl = stream.uri;
				const onvifUrl = device.xaddrs[0]; // Assuming the first XAddr is the ONVIF URL

				db.run(`INSERT INTO cameras (name, rtspUrl, onvifUrl, username, password) VALUES (?, ?, ?, ?, ?)`,
					[name, discoveredRtspUrl, onvifUrl, username, password],
					function (dbErr) {
						if (dbErr) {
							return res.status(500).json({ error: dbErr.message });
						}
						res.status(201).json({ id: this.lastID, name, rtspUrl: discoveredRtspUrl, onvifUrl, username, password });
					});
			});
		});
	} catch (error) {
		console.error('Error adding camera:', error);
		return res.status(500).json({ error: `Failed to add camera: ${error.message}` });
	}
});

// Update a camera
app.put('/api/cameras/:id', (req, res) => {
	const { id } = req.params;
	const { name, rtspUrl, onvifUrl, username, password } = req.body;

	if (!name || !rtspUrl) {
		return res.status(400).json({ error: 'Name and RTSP URL are required.' });
	}

	db.run(`UPDATE cameras SET name = ?, rtspUrl = ?, onvifUrl = ?, username = ?, password = ? WHERE id = ?`,
		[name, rtspUrl, onvifUrl, username, password, id],
		function (err) {
			if (err) {
				return res.status(500).json({ error: err.message });
			}
			if (this.changes === 0) {
				return res.status(404).json({ error: 'Camera not found.' });
			}
			res.json({ message: `Camera ${id} updated successfully.`, id, name, rtspUrl, onvifUrl, username, password });
		}
	);
});

// Get all cameras
app.get('/api/cameras', (req, res) => {
	db.all(`SELECT * FROM cameras`, [], (err, rows) => {
		if (err) {
			return res.status(500).json({ error: err.message });
		}
		res.json(rows);
	});
});

// Delete a camera
app.delete('/api/cameras/:id', (req, res) => {
	const { id } = req.params;

	db.run(`DELETE FROM cameras WHERE id = ?`, id, function (err) {
		if (err) {
			return res.status(500).json({ error: err.message });
		}
		if (this.changes === 0) {
			return res.status(404).json({ error: 'Camera not found.' });
		}
		res.json({ message: `Camera ${id} deleted successfully.` });
	});
});

// ONVIF Discovery
app.get('/api/onvif/discover', async (req, res) => {
	console.log('Starting ONVIF discovery...');
	const devices = [];
	onvif.Discovery.on('device', (device) => {
		console.log('Discovered ONVIF device:', device);
		devices.push({
			urn: device.urn,
			name: device.name,
			xaddrs: device.xaddrs,
			// Add other relevant device info
		});
	});
	onvif.Discovery.probe();

	// Stop probing after a timeout (e.g., 5 seconds)
	setTimeout(() => {
		console.log('ONVIF discovery finished. Found devices:', devices.length);
		res.json(devices);
	}, 5000);
});

// ONVIF PTZ Control
app.post('/api/onvif/control/:id', async (req, res) => {
	const cameraId = req.params.id;
	// Fetch camera details from the database
	db.get(`SELECT * FROM cameras WHERE id = ?`, [cameraId], (err, camera) => {
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
			return res.status(400).json({ error: 'Camera details (ONVIF URL, username, password) are required for control.' });
		}

		new onvif.Cam({
			hostname: onvifUrl.split('/')[2].split(':')[0], // Extract hostname from onvifUrl
			username: username,
			password: password,
			port: onvifUrl.split('/')[2].split(':')[1] || 80 // Extract port or default to 80
		}, function (err, device) {
			if (err) {
				console.error('Connection Failed for ONVIF PTZ control:', err);
				return res.status(500).json({ error: `Failed to connect to camera for PTZ control: ${err.message}` });
			}

			const ptz = device.ptz;
			if (!ptz) {
				return res.status(500).json({ error: 'PTZ service not available for this device.' });
			}

			let ptzCommand;
			switch (command) {
				case 'moveUp':
					ptzCommand = { y: speed };
					break;
				case 'moveDown':
					ptzCommand = { y: -speed };
					break;
				case 'moveLeft':
					ptzCommand = { x: -speed };
					break;
				case 'moveRight':
					ptzCommand = { x: speed };
					break;
				case 'zoomIn':
					ptzCommand = { zoom: speed };
					break;
				case 'zoomOut':
					ptzCommand = { zoom: -speed };
					break;
				case 'stop':
					ptzCommand = { x: 0, y: 0, zoom: 0 };
					break;
				default:
					return res.status(400).json({ error: 'Invalid PTZ command.' });
			}

			if (command === 'stop') {
				ptz.stop({ panTilt: true, zoom: true }, (err) => {
					if (err) {
						console.error('Error stopping PTZ:', err);
						return res.status(500).json({ error: err.message });
					}
					res.json({ message: `PTZ stop command sent to camera ${cameraId}.` });
				});
			} else {
				ptz.continuousMove(ptzCommand, (err) => {
					if (err) {
						console.error('Error sending continuous move command:', err);
						return res.status(500).json({ error: err.message });
					}
					res.json({ message: `PTZ ${command} command sent to camera ${cameraId}.` });
				});
			}
		});
	});
});


// WebSocket for camera streaming (placeholder for now)
app.ws('/api/camera/:id/stream', (ws, req) => {
	const cameraId = req.params.id;
	console.log(`WebSocket connection established for camera ${cameraId}`);

	ws.on('message', (msg) => {
		console.log(`Received message for camera ${cameraId}: ${msg}`);
		// Here you would typically forward this message to the camera or a streaming process
	});

	ws.on('close', () => {
		console.log(`WebSocket connection closed for camera ${cameraId}`);
	});

	ws.on('error', (error) => {
		console.error(`WebSocket error for camera ${cameraId}:`, error);
	});
});


app.listen(port, () => {
	console.log(`Backend server listening at http://localhost:${port}`);
});
