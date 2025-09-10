const express = require('express');
const path = require('path');
const { Cam } = require('onvif');

const app = express();
const port = 3000;

const config = {
	hostname: '192.168.0.103',
	port: 8899,
	user: 'user',
	pass: 'pw',
};

let cameraDevice;
let ptzProfile; // NEW: We will store the PTZ-enabled profile here

// Middleware
app.use(express.static(path.resolve(__dirname, 'public')));
app.use(express.json());

// API endpoint for PTZ control
app.post('/api/ptz', async (req, res) => {
	const { direction, action } = req.body;

	// MODIFIED: Check if we found a usable PTZ profile during initialization
	if (!ptzProfile) {
		return res.status(503).send({ message: 'A PTZ-enabled profile was not found on this camera.' });
	}

	console.log(`Received PTZ command: ${action} ${direction}`);

	try {
		if (action === 'stop' && cameraDevice.services.ptz?.stop) {
			// MODIFIED: Pass the profile token to the stop command
			await cameraDevice.services.ptz.stop({ profileToken: ptzProfile.token });
			return res.status(200).send({ message: 'Stop command successful.' });
		}

		const params = {
			// MODIFIED: Explicitly provide the profile token
			profileToken: ptzProfile.token,
			speed: { x: 0, y: 0, z: 0 },
			timeout: 1
		};
		console.log(params);

		const speed = 0.6;
		switch (direction) {
			case 'up': params.speed.y = speed; break;
			case 'down': params.speed.y = -speed; break;
			case 'left': params.speed.x = -speed; break;
			case 'right': params.speed.x = speed; break;
		}

		await cameraDevice.services.ptz.continuousMove(params);
		res.status(200).send({ message: `Move command ${direction} successful.` });

	} catch (error) {
		console.error('Error executing PTZ command:', error);
		res.status(500).send({ message: 'Error executing PTZ command.' });
	}
});


// --- Initialization ---
console.log('Attempting to connect to camera...');

new Cam(config, function (err) {
	if (err) {
		console.error('CONNECTION FAILED:', err);
		return;
	}

	cameraDevice = this;
	console.log('CAMERA CONNECTED SUCCESSFULLY!');

	// --- NEW: Profile Discovery Logic ---
	console.log('Searching for a PTZ-enabled profile...');

	// The 'profiles' array is populated during initialization
	if (cameraDevice.profiles && cameraDevice.profiles.length > 0) {
		// Find the first profile that has a ptzConfiguration
		ptzProfile = cameraDevice.profiles.find(profile => profile.ptzConfiguration || profile.PTZConfiguration);
		ptzProfile.token = ptzProfile.PTZConfiguration.token || ptzProfile.PTZConfiguration.nodeToken;
		console.log(ptzProfile);
	}

	if (ptzProfile) {
		console.log(`SUCCESS: Found PTZ profile: "${ptzProfile.name}" (Token: ${ptzProfile.token})`);
	} else {
		console.error('ERROR: Could not find any profile with PTZ configuration!');
		console.error('The camera is connected, but PTZ control will not work.');
	}
	// --- End of New Logic ---

	// Now that we've checked for profiles, start the web server
	app.listen(port, () => {
		console.log(`Server listening at http://localhost:${port}`);
		console.log('Web app is ready. Open your browser.');
	});
});
