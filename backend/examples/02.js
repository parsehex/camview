// this file works to move my 10+ year old camera

const onvif = require('node-onvif');

const config = {
	xaddr: 'http://192.168.0.103:8899/onvif/device_service',
	user: 'user',
	pass: 'pw',
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runTest() {
	console.log(`Attempting to connect to camera at ${config.address}...`);

	try {
		const device = new onvif.OnvifDevice(config);
		console.log('SUCCESS: Connected to camera!');

		await device.init();
		console.log('Camera initialized. Moving...');

		await device.ptzMove({
			'speed': {
				x: -1.0, // Speed of pan (in the range of -1.0 to 1.0)
				y: 0.0, // Speed of tilt (in the range of -1.0 to 1.0)
				z: 0.0  // Speed of zoom (in the range of -1.0 to 1.0)
			},
		});

		await wait(1000);

		await device.ptzStop();

		console.log('\nSUCCESS: Test complete. The camera should have moved.');

	} catch (error) {
		console.error('\n--- AN ERROR OCCURRED ---');
		console.error(error);
		console.error('-------------------------');
	}
}

runTest();
