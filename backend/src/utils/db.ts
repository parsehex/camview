import * as sqlite3 from 'sqlite3';
import { CameraDbRow } from '../types/camera';
import { AppSetting } from '../types/app-settings';
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
					db.run(
						`CREATE TABLE IF NOT EXISTS app_settings (
							key TEXT PRIMARY KEY,
							value TEXT
						)`,
						(err: Error | null) => {
							if (err) {
								console.error(
									'Error creating app_settings table:',
									err.message
								);
							} else {
								console.log('App settings table created or already exists.');
								// Initialize default settings if they don't exist
								db.get(
									`SELECT value FROM app_settings WHERE key = 'keep_streams_open'`,
									(err, row: AppSetting | undefined) => {
										if (err) {
											console.error(
												'Error checking keep_streams_open setting:',
												err.message
											);
										} else if (!row) {
											db.run(
												`INSERT INTO app_settings (key, value) VALUES (?, ?)`,
												['keep_streams_open', 'false'],
												(insertErr) => {
													if (insertErr) {
														console.error(
															'Error inserting default keep_streams_open setting:',
															insertErr.message
														);
													} else {
														console.log(
															'Default setting "keep_streams_open" added.'
														);
													}
												}
											);
										}
									}
								);
							}
						}
					);
				}
			}
		);
	}
});

export function getAppSetting(key: string): Promise<string | undefined> {
	return new Promise((resolve, reject) => {
		db.get(
			`SELECT value FROM app_settings WHERE key = ?`,
			[key],
			(err, row: AppSetting | undefined) => {
				if (err) {
					reject(err);
				} else {
					resolve(row?.value);
				}
			}
		);
	});
}

export function setAppSetting(key: string, value: string): Promise<void> {
	return new Promise((resolve, reject) => {
		db.run(
			`INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`,
			[key, value],
			function (err) {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			}
		);
	});
}

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
