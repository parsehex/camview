import Database from 'better-sqlite3';
import { CameraDbRow } from '../types/camera';
import { AppSetting } from '../types/app-settings';
import { getDevice } from './onvif';

export const db = new Database('./camview.db');

console.log('Connected to the SQLite database.');

db.exec(`
    CREATE TABLE IF NOT EXISTS cameras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        rtspUrl TEXT NOT NULL,
        onvifUrl TEXT,
        username TEXT,
        password TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
`);

console.log('Tables created or already exist.');

// Initialize default settings if they don't exist
const initializeSetting = (key: string, defaultValue: string) => {
	const setting = db
		.prepare(`SELECT value FROM app_settings WHERE key = ?`)
		.get(key) as AppSetting | undefined;
	if (!setting) {
		db.prepare(`INSERT INTO app_settings (key, value) VALUES (?, ?)`).run(
			key,
			defaultValue
		);
		console.log(`Default setting "${key}" added.`);
	}
};

initializeSetting('keep_streams_open', 'false');
initializeSetting('ollamaHost', '127.0.0.1:11434');
initializeSetting('ollamaModel', 'gemma3:4b');

connectToExistingCameras();

export function getAppSetting(key: string): Promise<string | undefined> {
	return Promise.resolve(
		(
			db.prepare(`SELECT value FROM app_settings WHERE key = ?`).get(key) as
				| AppSetting
				| undefined
		)?.value
	);
}

export function setAppSetting(key: string, value: string): Promise<void> {
	db.prepare(
		`INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`
	).run(key, value);
	return Promise.resolve();
}

export async function connectToExistingCameras() {
	console.log('Attempting to connect to existing cameras...');
	try {
		const rows = db
			.prepare<CameraDbRow[]>(`SELECT * FROM cameras`)
			.all() as CameraDbRow[];
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
	} catch (err: any) {
		console.error(
			'Error fetching cameras for initial connection:',
			err.message
		);
	}
}
