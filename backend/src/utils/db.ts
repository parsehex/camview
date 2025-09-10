import * as sqlite3 from 'sqlite3';
import { CameraDbRow } from '../types/camera';
import { getDevice } from './onvif';

export const db = new sqlite3.Database('./camview.db', (err: Error | null) => {
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
					connectToExistingCameras();
				}
			}
		);
	}
});

export async function connectToExistingCameras() {
	console.log('Attempting to connect to existing cameras...');
	db.all<CameraDbRow>(`SELECT * FROM cameras`, [], async (err, rows) => {
		if (err) {
			console.error(
				'Error fetching cameras for initial connection:',
				err.message
			);
			return;
		}
		for (const camera of rows) {
			try {
				const host = new URL(camera.onvifUrl).hostname;
				await getDevice(
					camera.onvifUrl,
					camera.username,
					camera.password,
					'camera-' + camera.name
				);
				console.log(
					`Successfully reconnected to camera: ${camera.name} (${host})`
				);
			} catch (error: any) {
				console.error(
					`Failed to reconnect to camera ${camera.name}: ${error.message}`
				);
			}
		}
		console.log('Finished attempting to connect to existing cameras.');
	});
}
