import express, { Application, Request, Response, NextFunction } from 'express';
import * as expressWs from 'express-ws';
import { WebSocket } from 'ws';
import cameraRoutes from './routes/camera';
import { cameraStreamWs } from './routes/stream-ws';
import settingsRoutes from './routes/settings';
import ollamaRoutes from './routes/ollama';

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

// Initialize SQLite database and connect to existing cameras
// This is now handled in backend/src/utils/db.ts
// The connectToExistingCameras function is called after table creation in db.ts

// API Endpoints
app.get('/', (req: Request, res: Response) => {
	res.send('Camview Backend is running!');
});

app.use(cameraRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/ollama', ollamaRoutes);
app.ws('/api/camera/:id/stream', cameraStreamWs);

app.listen(port, () => {
	console.log(`Backend server listening at http://localhost:${port}`);
});
