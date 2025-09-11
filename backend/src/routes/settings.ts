import { Router, Request, Response } from 'express';
import { getAppSetting, setAppSetting } from '../utils/db';

const router = Router();

// GET /api/settings
router.get('/', async (req: Request, res: Response) => {
	try {
		const keepStreamsOpen = await getAppSetting('keep_streams_open');
		const ollamaHost = await getAppSetting('ollamaHost');
		const ollamaModel = await getAppSetting('ollamaModel');

		res.json({
			keep_streams_open: keepStreamsOpen,
			ollamaHost: ollamaHost,
			ollamaModel: ollamaModel,
		});
	} catch (error: any) {
		console.error('Error getting all app settings:', error);
		res.status(500).json({ error: error.message });
	}
});

// PUT /api/settings/:key
router.put('/:key', async (req: Request, res: Response) => {
	const { key } = req.params;
	const { value } = req.body;

	if (value === undefined) {
		return res.status(400).json({ error: 'Value is required.' });
	}

	try {
		await setAppSetting(key, value.toString());
		res.json({
			message: `Setting "${key}" updated successfully.`,
			key: key,
			value: value,
		});
	} catch (error: any) {
		console.error(`Error setting ${key} setting:`, error);
		res.status(500).json({ error: error.message });
	}
});

export default router;
