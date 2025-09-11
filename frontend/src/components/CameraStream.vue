<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { Play, Square, RotateCw, MessageSquareText } from 'lucide-vue-next';
import mpegts from 'mpegts.js';
import PtzControls from './PtzControls.vue';
import { delay } from '@/utils';

const props = defineProps<{
	cameraId: number;
	rtspUrl: string;
}>();

const onvifControlAvailable = ref(true); // Assume ONVIF control is available if camera has an ID

const sendPtzCommand = async (command: string, speed: number = 0.5) => {
	// The backend will fetch ONVIF URL, username, and password from the database
	// based on the cameraId.
	try {
		console.log(`Sending ONVIF PTZ command: ${command} with speed ${speed} to camera ${props.cameraId}`);
		const response = await fetch(`http://localhost:3000/api/onvif/control/${props.cameraId}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ command, speed }),
		});
		const result = await response.json();
		console.log('PTZ command response:', result);
	} catch (error) {
		console.error('Error sending PTZ command:', error);
	}
};

const videoRef = ref<HTMLVideoElement | null>(null);
let ws: WebSocket | null = null;
let mpegtsPlayer: mpegts.Player | null = null;
const isStreaming = ref(false);

const toggleStream = () => {
	if (isStreaming.value) {
		stopStream();
	} else {
		startStream();
	}
};

const showOllamaControls = ref(false);
const ollamaPrompt = ref(localStorage.getItem(`ollamaPrompt-${props.cameraId}`) || '');
const ollamaResponse = ref('');
const ollamaImage = ref(''); // New ref for the image
const isQueryingOllama = ref(false);

const toggleOllamaControls = () => {
	showOllamaControls.value = !showOllamaControls.value;
};

const saveOllamaPrompt = () => {
	localStorage.setItem(`ollamaPrompt-${props.cameraId}`, ollamaPrompt.value);
};

const queryOllama = async () => {
	if (!ollamaPrompt.value) {
		alert('Please enter a prompt.');
		return;
	}

	isQueryingOllama.value = true;
	ollamaResponse.value = ''; // Clear previous response
	ollamaImage.value = ''; // Clear previous image

	try {
		const response = await fetch('http://localhost:3000/api/ollama/query', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				prompt: ollamaPrompt.value,
				cameraId: props.cameraId,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Backend error: ${errorText}`);
		}

		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error('Failed to get response reader.');
		}

		const decoder = new TextDecoder();
		let result = '';
		let isFirstLine = true;
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			const chunk = decoder.decode(value, { stream: true });

			if (isFirstLine) {
				const lines = (result + chunk).split('\n');
				if (lines.length > 1) {
					ollamaImage.value = lines[0];
					result = lines.slice(1).join('\n');
					isFirstLine = false;
				} else {
					result += chunk;
				}
			} else {
				result += chunk;
			}
			ollamaResponse.value = result; // Update in real-time
		}
	} catch (error: any) {
		console.error('Error querying Ollama:', error);
		ollamaResponse.value = `Error: ${error.message}`;
	} finally {
		isQueryingOllama.value = false;
	}
};

const restartStream = async () => {
	console.log('Restarting stream...');
	stopStream();
	await delay(50);
	startStream();
};

const startStream = () => {
	if (!props.rtspUrl) {
		console.error('RTSP URL is not provided.');
		return;
	}

	console.log(`Attempting to start stream for camera ${props.cameraId} from ${props.rtspUrl}`);

	if (mpegts.isSupported()) {
		if (videoRef.value) {
			mpegtsPlayer = mpegts.createPlayer({
				type: 'mpegts',
				isLive: true,
				url: `ws://localhost:3000/api/camera/${props.cameraId}/stream`,
			}, {
				// Optional: Adjust buffer settings for lower latency
				// liveBufferLatencyChasing: true,
				// liveBufferLatencyMaxLatency: 0.5, // seconds
				// liveBufferLatencyMinRemain: 0.1, // seconds
			});
			mpegtsPlayer.attachMediaElement(videoRef.value);
			mpegtsPlayer.load();
			mpegtsPlayer?.play();
			isStreaming.value = true;


			mpegtsPlayer.on(mpegts.Events.ERROR, (errorType, errorDetail, errorInfo) => {
				console.error('mpegts.js error:', errorType, errorDetail, errorInfo);
				stopStream();
			});

			console.log('mpegts.js player initialized and attempting to play.');
		} else {
			console.error('Video element not found.');
		}
	} else {
		console.error('MPEG-TS is not supported in this browser.');
	}
};

const stopStream = () => {
	if (ws) {
		ws.close();
		ws = null;
	}
	if (mpegtsPlayer) {
		mpegtsPlayer.destroy();
		mpegtsPlayer = null;
	}
	if (videoRef.value) {
		videoRef.value.src = '';
	}
	isStreaming.value = false;
	console.log('Stream stopped.');
};

onBeforeUnmount(() => {
	stopStream();
});
</script>
<template>
	<div class="camera-stream-container">
		<div class="camera-stream">
			<div class="video-and-controls">
				<video ref="videoRef" controls autoplay muted></video>
				<div class="stream-buttons">
					<button v-if="isStreaming" @click="restartStream" class="restart-stream-button">
						<RotateCw />
					</button>
					<button @click="toggleStream" :class="['stream-toggle-button', isStreaming ? 'is-streaming' : '']">
						<Square v-if="isStreaming" />
						<Play v-else />
					</button>
					<button @click="toggleOllamaControls" class="ollama-toggle-button">
						<MessageSquareText />
					</button>
				</div>
			</div>
			<div v-if="showOllamaControls" class="ollama-controls">
				<h3>Ollama AI Query</h3>
				<textarea v-model="ollamaPrompt" @input="saveOllamaPrompt" placeholder="Enter your prompt for Ollama..."
					rows="4"></textarea>
				<button @click="queryOllama" :disabled="isQueryingOllama"> {{ isQueryingOllama ? 'Querying...' : 'Query Ollama'
				}} </button>
				<div v-if="ollamaResponse || ollamaImage" class="ollama-response">
					<h4>Response:</h4>
					<img v-if="ollamaImage" :src="ollamaImage" alt="Query Image" class="ollama-query-image" />
					<p>{{ ollamaResponse }}</p>
				</div>
			</div>
		</div>
		<PtzControls v-if="onvifControlAvailable" :camera-id="cameraId" :send-ptz-command="sendPtzCommand" />
	</div>
</template>
<style scoped>
.camera-stream-container {
	display: flex;
	gap: 20px;
	margin-top: 20px;
	flex-wrap: wrap;
	/* Allow wrapping for smaller screens */
}

.camera-stream {
	flex-grow: 1;
	border: 1px solid #eee;
	padding: 10px;
	border-radius: 8px;
	background-color: #f0f0f0;
	display: flex;
	flex-direction: column;
	/* Stack video and ollama controls vertically */
	align-items: center;
	justify-content: center;
	gap: 15px;
	/* Space between video and ollama controls */
}

.video-and-controls {
	display: flex;
	align-items: center;
	gap: 10px;
	width: 100%;
	/* Ensure it takes full width */
	justify-content: center;
}

video {
	width: 100%;
	height: 360px;
	max-width: 640px;
	display: block;
	background-color: black;
	/* Placeholder for video feed */
}

.stream-buttons {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.stream-toggle-button,
.restart-stream-button,
.ollama-toggle-button {
	background-color: #28a745;
	color: white;
	border: none;
	border-radius: 50%;
	width: 40px;
	height: 40px;
	display: flex;
	justify-content: center;
	align-items: center;
	cursor: pointer;
	transition: background-color 0.3s ease;
	padding: 0;
}

.stream-toggle-button:hover,
.restart-stream-button:hover,
.ollama-toggle-button:hover {
	background-color: #218838;
}

.stream-toggle-button .lucide,
.restart-stream-button .lucide,
.ollama-toggle-button .lucide {
	stroke: white;
}

.stream-toggle-button.is-streaming {
	background-color: #dc3545;
}

.stream-toggle-button.is-streaming:hover {
	background-color: #c82333;
}

.restart-stream-button {
	background-color: #ffc107;
}

.restart-stream-button:hover {
	background-color: #e0a800;
}

.ollama-toggle-button {
	background-color: #007bff;
	/* Blue for Ollama button */
}

.ollama-toggle-button:hover {
	background-color: #0056b3;
}

.ollama-controls {
	width: 100%;
	max-width: 640px;
	/* Match video width */
	padding: 15px;
	margin: auto;
	border: 1px solid #ccc;
	border-radius: 8px;
	background-color: #fff;
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.ollama-controls h3 {
	margin-top: 0;
	color: #333;
}

.ollama-controls textarea {
	width: calc(100% - 20px);
	/* Account for padding */
	padding: 10px;
	border: 1px solid #ddd;
	border-radius: 5px;
	font-size: 1rem;
	resize: vertical;
	min-height: 80px;
}

.ollama-controls button {
	align-self: flex-start;
	/* Align button to the left */
	padding: 10px 20px;
	background-color: #28a745;
	color: white;
	border: none;
	border-radius: 5px;
	cursor: pointer;
	transition: background-color 0.3s ease;
}

.ollama-controls button:hover:not(:disabled) {
	background-color: #218838;
}

.ollama-controls button:disabled {
	background-color: #cccccc;
	cursor: not-allowed;
}

.ollama-response {
	margin-top: 15px;
	padding: 10px;
	border: 1px solid #eee;
	border-radius: 5px;
	background-color: #f0f8ff;
	white-space: pre-wrap;
	/* Preserve whitespace and line breaks */
}

.ollama-query-image {
	max-width: 100%;
	height: auto;
	margin-bottom: 10px;
	border-radius: 4px;
	border: 1px solid #ddd;
}

.ollama-response h4 {
	margin-top: 0;
	color: #555;
}

/* General button styles (moved to the end or a common file if many components use it) */
button {
	padding: 8px 12px;
	background-color: #007bff;
	color: white;
	border: none;
	border-radius: 4px;
	cursor: pointer;
	margin-right: 10px;
}

button:hover {
	background-color: #0056b3;
}

.stream-toggle-button:hover {
	background-color: #218838;
}

.stream-toggle-button .lucide {
	stroke: white;
}

/* Style for stop icon when streaming */
.stream-toggle-button.is-streaming {
	background-color: #dc3545;
}

.stream-toggle-button.is-streaming:hover {
	background-color: #c82333;
}

.camera-stream-container {
	display: flex;
	gap: 20px;
	margin-top: 20px;
}

.camera-stream {
	flex-grow: 1;
	border: 1px solid #eee;
	padding: 10px;
	border-radius: 8px;
	background-color: #f0f0f0;
	display: flex;
	align-items: center;
	justify-content: center;
}

video {
	width: 100%;
	height: 360px;
	max-width: 640px;
	display: block;
}

.video-and-controls {
	display: flex;
	align-items: center;
	gap: 10px;
}

.stream-buttons {
	display: flex;
	flex-direction: column;
	gap: 10px;
	/* Space between the buttons */
}

.restart-stream-button {
	background-color: #ffc107;
	/* A distinct color, e.g., yellow for restart */
	color: white;
	border: none;
	border-radius: 50%;
	width: 40px;
	height: 40px;
	display: flex;
	justify-content: center;
	align-items: center;
	cursor: pointer;
	transition: background-color 0.3s ease;
	padding: 0;
}

.restart-stream-button:hover {
	background-color: #e0a800;
}

.restart-stream-button .lucide {
	stroke: white;
}

button {
	/* General button styles */
	padding: 8px 12px;
	background-color: #007bff;
	color: white;
	border: none;
	border-radius: 4px;
	cursor: pointer;
	margin-right: 10px;
}

button:hover {
	background-color: #0056b3;
}
</style>
