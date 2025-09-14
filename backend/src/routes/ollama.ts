import express from 'express';
import { Ollama } from 'ollama';
import { getAppSetting } from '../utils/db';
import { getFrameAsBase64 } from './stream-ws';

const router = express.Router();

router.post('/query', async (req, res) => {
	try {
		const ollamaHost = await getAppSetting('ollamaHost');
		const ollamaModel = await getAppSetting('ollamaModel');
		const {
			prompt,
			cameraId,
			responseType = 'string',
			think = false,
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

		const imageBase64 = await getFrameAsBase64(cameraId);

		res.writeHead(200, {
			'Content-Type': 'text/plain',
			'Transfer-Encoding': 'chunked',
		});

		res.write(`data:image/jpeg;base64,${imageBase64}\n`); // Send image as the first line

		const ollamaInstance = new Ollama({ host: ollamaHost });

		// Construct enhanced prompt based on parameters
		let enhancedPrompt = prompt;
		if (think) {
			enhancedPrompt = `Please analyze this image and provide your reasoning.
First, think step by step about what you see to improve your response, and share your thoughts in a "thoughts" key.
Then, provide the final answer in a "value" key.
The response should be in JSON format with keys "thoughts" and "value".

${prompt}`;
		} else if (responseType === 'array') {
			enhancedPrompt = `Please analyze this image and provide a list of items.
Return your response as a JSON object with a "value" key containing an array.

${prompt}`;
		} else {
			enhancedPrompt = `Attached is a single frame from a security camera. Assistant's task is to evaluate and respond to the following query:

${prompt}`;
		}

		const response = await ollamaInstance.generate({
			model: ollamaModel,
			prompt: enhancedPrompt,
			format: !isCustom ? 'json' : undefined,
			images: [imageBase64],
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
