import express from 'express';
import { Ollama } from 'ollama';
import { getAppSetting } from '../utils/db';
import { getFrameAsBase64, getFramesAsBase64 } from './stream-ws';

const router = express.Router();

function queryPrompt(
	query: string,
	responseType: string,
	isCustom: boolean,
	think: boolean,
	frameCount: number
) {
	let promptParts: string[] = [];

	// Add JSON formatting instructions when not using custom queries
	if (!isCustom) {
		if (think) {
			promptParts.push(`Please analyze this image and provide your reasoning.
First, think step by step about what you see to improve your response, and share your thoughts in a "thoughts" key.
Then, provide the final answer in a "value" key.
The response should be in JSON format with keys "thoughts" and "value".`);
		} else if (responseType === 'array') {
			promptParts.push(`Please analyze this image and provide a list of items.
Return your response as a JSON object with a "value" key containing an array.`);
		} else {
			promptParts.push(
				`Return your response as a JSON object with a "value" key.`
			);
		}
	}

	// frame description based on count
	if (frameCount > 1) {
		promptParts.push(
			`Attached are ${frameCount} sequential frames from a security camera, captured with a 1-second interval between each frame.`
		);
	} else {
		promptParts.push(`Attached is a single frame from a security camera.`);
	}

	// main task description
	promptParts.push(
		`Assistant's task is to evaluate and respond to the following query:`
	);

	return promptParts.join('\n\n') + '\n' + query;
}

router.post('/query', async (req, res) => {
	try {
		const ollamaHost = await getAppSetting('ollamaHost');
		const ollamaModel = await getAppSetting('ollamaModel');
		const {
			prompt,
			cameraId,
			responseType = 'string',
			think = false,
			frameCount = 1,
			isCustom = false,
		} = req.body;

		if (!ollamaHost) {
			return res.status(400).send('Ollama Host is not configured.');
		}
		if (!ollamaModel) {
			return res.status(400).send('Ollama Model is not configured.');
		}
		if (!prompt) {
			return res.status(400).send('Prompt is required.');
		}
		if (!cameraId) {
			return res.status(400).send('Camera ID is required.');
		}

		const frameCountNum = Math.max(1, Math.min(Number(frameCount), 10)); // Limit to 1-10 frames
		const imagesBase64 =
			frameCountNum > 1
				? await getFramesAsBase64(cameraId, frameCountNum, 2500)
				: [await getFrameAsBase64(cameraId)];

		res.writeHead(200, {
			'Content-Type': 'text/plain',
			'Transfer-Encoding': 'chunked',
		});

		// Send all images as the first lines, separated by newlines
		for (const imageBase64 of imagesBase64) {
			res.write(`data:image/jpeg;base64,${imageBase64}\n`);
		}

		const ollamaInstance = new Ollama({ host: ollamaHost });

		const format = !isCustom ? 'json' : undefined;
		const response = await ollamaInstance.generate({
			model: ollamaModel,
			prompt: queryPrompt(prompt, responseType, isCustom, think, frameCountNum),
			format,
			images: imagesBase64,
			stream: true,
			options: { temperature: 0.05, num_predict: 512 },
		});

		let lastPart: any;
		for await (const part of response) {
			res.write(part.response);
			lastPart = part;
		}
		if (lastPart) {
			console.log(
				'Total tokens:',
				lastPart.eval_count + lastPart.prompt_eval_count
			);
		}
		res.end();
	} catch (error: any) {
		console.error('Error querying Ollama:', error);
		res.status(500).send(error.message);
	}
});

export default router;
