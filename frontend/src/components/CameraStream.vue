<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { Play, Square } from 'lucide-vue-next';
import mpegts from 'mpegts.js';
import PtzControls from './PtzControls.vue';

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
				<button @click="toggleStream" :class="['stream-toggle-button', isStreaming ? 'is-streaming' : '']">
					<Square v-if="isStreaming" />
					<Play v-else />
				</button>
			</div>
		</div>
		<PtzControls v-if="onvifControlAvailable" :camera-id="cameraId" :send-ptz-command="sendPtzCommand" />
	</div>
</template>
<style scoped>
.stream-toggle-button {
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
	max-width: 640px;
	display: block;
}

.video-and-controls {
	display: flex;
	align-items: center;
	gap: 10px;
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
