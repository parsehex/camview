<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import { Play, Square, RotateCw, Code } from 'lucide-vue-next';
import mpegts from 'mpegts.js';
import PtzControls from './PtzControls.vue';
import { delay } from '@/utils';
import CustomStreamQuery from './CustomStreamQuery.vue';
import StreamQueryManager from './StreamQueryManager.vue';

const props = defineProps<{
	cameraId: number | string;
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
const ollamaViewMode = ref<'simple' | 'advanced'>('simple'); // 'simple' for CustomStreamQuery, 'advanced' for StreamQueryManager
const ollamaPrompt = ref(localStorage.getItem(`ollamaPrompt-${props.cameraId}`) || '');
const ollamaResponse = ref('');
const ollamaImage = ref(''); // New ref for the image
const isQueryingOllama = ref(false);

const toggleOllamaControls = () => {
	showOllamaControls.value = !showOllamaControls.value;
	// Reset to simple view when toggling off/on
	if (showOllamaControls.value) {
		ollamaViewMode.value = 'simple';
	}
};

const switchOllamaView = (mode: 'simple' | 'advanced') => {
	ollamaViewMode.value = mode;
};

const getToggleButtonClass = (mode: 'simple' | 'advanced') => {
	const baseClasses = 'flex-1 py-2 px-3 text-white border-none rounded cursor-pointer text-sm transition-colors duration-200';
	const isActive = ollamaViewMode.value === mode;
	return isActive
		? `${baseClasses} bg-blue-500 hover:bg-blue-600`
		: `${baseClasses} bg-gray-500 hover:bg-gray-600`;
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
				liveBufferLatencyChasing: true,
			});
			mpegtsPlayer.attachMediaElement(videoRef.value);
			mpegtsPlayer.load();
			mpegtsPlayer?.play();
			isStreaming.value = true;

			const streamStartTime = Date.now();
			let firstFrameRendered = false;
			mpegtsPlayer.on(mpegts.Events.MEDIA_INFO, (statisticsInfo) => {
				if (!firstFrameRendered) {
					const timeToFirstFrame = (Date.now() - streamStartTime) / 1000;
					console.log(`[${Date.now()}] Time to first frame: ${timeToFirstFrame.toFixed(3)}s for camera ${props.cameraId}`);
					firstFrameRendered = true;
				}
			});

			mpegtsPlayer.on(mpegts.Events.ERROR, (errorType, errorDetail, errorInfo) => {
				console.error('mpegts.js error:', errorType, errorDetail, errorInfo);
				stopStream();
			});

			console.log(`[${Date.now()}] mpegts.js player initialized and attempting to play for camera ${props.cameraId}.`);
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
	<div class="flex gap-5 mt-2 flex-wrap">
		<div
			class="flex-grow border border-gray-200 p-2.5 rounded-lg bg-gray-100 flex flex-col items-center justify-center gap-3.75">
			<div class="flex items-center gap-2.5 w-full justify-center">
				<video ref="videoRef" controls autoplay muted class="w-full h-90 max-w-[640px] block bg-black"></video>
				<div class="flex flex-col gap-2.5">
					<button v-if="isStreaming" @click="restartStream"
						class="w-10 h-10 flex justify-center items-center cursor-pointer p-0 rounded-full bg-amber-400 hover:bg-amber-500 text-white transition-colors duration-300">
						<RotateCw class="stroke-white" />
					</button>
					<button @click="toggleStream"
						:class="['w-10 h-10 flex justify-center items-center cursor-pointer p-0 rounded-full transition-colors duration-300', isStreaming ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600']">
						<Square v-if="isStreaming" class="stroke-white" />
						<Play v-else class="stroke-white" />
					</button>
					<button @click="toggleOllamaControls"
						class="w-10 h-10 flex justify-center items-center cursor-pointer p-0 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-300"
						title="Queries">
						<Code class="stroke-white" />
					</button>
				</div>
			</div>
		</div>
		<PtzControls v-if="onvifControlAvailable" :camera-id="cameraId" :send-ptz-command="sendPtzCommand" />
	</div>
	<div v-if="showOllamaControls" class="mt-5">
		<div class="flex gap-2 mb-4">
			<button @click="switchOllamaView('simple')" :class="getToggleButtonClass('simple')"> Simple </button>
			<button @click="switchOllamaView('advanced')" :class="getToggleButtonClass('advanced')"> Advanced </button>
		</div>
		<CustomStreamQuery v-if="ollamaViewMode === 'simple'" :camera-id="cameraId" />
		<StreamQueryManager v-if="ollamaViewMode === 'advanced'" :camera-id="cameraId" />
	</div>
</template>
