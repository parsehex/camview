import { Router, Request, Response } from 'express';
import { getAppSetting, setAppSetting } from '../utils/db';

const router = Router();

// GET /api/settings/keep-streams-open
router.get('/keep-streams-open', async (req: Request, res: Response) => {
	try {
		const value = await getAppSetting('keep_streams_open');
		res.json({ keep_streams_open: value === 'true' });
	} catch (error: any) {
		console.error('Error getting keep_streams_open setting:', error);
		res.status(500).json({ error: error.message });
	}
});

// PUT /api/settings/keep-streams-open
router.put('/keep-streams-open', async (req: Request, res: Response) => {
	const { value } = req.body;
	if (typeof value !== 'boolean') {
		return res.status(400).json({ error: 'Value must be a boolean.' });
	}

	try {
		await setAppSetting('keep_streams_open', value.toString());
		res.json({
			message: 'Setting updated successfully.',
			keep_streams_open: value,
		});
	} catch (error: any) {
		console.error('Error setting keep_streams_open setting:', error);
		res.status(500).json({ error: error.message });
	}
});

export default router;
