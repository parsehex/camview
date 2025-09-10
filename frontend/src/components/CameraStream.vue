<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps<{
	cameraId: number;
	rtspUrl: string;
}>();

const onvifControlAvailable = ref(true); // Assume ONVIF control is available if camera has an ID

const sendPtzCommand = async (command: string, speed: number = 0.5) => {
	// The backend will fetch ONVIF URL, username, and password from the database
	// based on the cameraId.
	try {
		// In a real application, you would send this to your backend
		// which then uses the 'onvif' library to control the camera.
		console.log(`Sending ONVIF PTZ command: ${command} with speed ${speed} to camera ${props.cameraId}`);
		// Example: You might send a WebSocket message or an HTTP request to your backend
		// ws.send(JSON.stringify({ type: 'ptz', command, speed }));
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
let mediaSource: MediaSource | null = null;
let sourceBuffer: SourceBuffer | null = null;

const startStream = () => {
	if (!props.rtspUrl) {
		console.error('RTSP URL is not provided.');
		return;
	}

	// Placeholder for actual RTSP streaming logic
	// In a real application, you would use a library like `mpegts.js` or `hls.js`
	// to play the RTSP stream, potentially transcoded by the backend.
	console.log(`Attempting to start stream for camera ${props.cameraId} from ${props.rtspUrl}`);

	// Example: Using a WebSocket to receive video data (requires backend transcoding)
	ws = new WebSocket(`ws://localhost:3000/api/camera/${props.cameraId}/stream`);

	ws.onopen = () => {
		console.log('WebSocket connected for streaming.');
		if (videoRef.value) {
			mediaSource = new MediaSource();
			videoRef.value.src = URL.createObjectURL(mediaSource);

			mediaSource.addEventListener('sourceopen', () => {
				if (mediaSource && mediaSource.readyState === 'open') {
					// You'll need to know the codec of your RTSP stream.
					// For H.264, it might be 'video/mp4; codecs="avc1.42E01E"'
					// For simplicity, let's assume a common one for now.
					// In a real scenario, the backend would tell the frontend the codec.
					const mimeCodec = 'video/webm; codecs="vp8"'; // Example codec, adjust as needed

					if (MediaSource.isTypeSupported(mimeCodec)) {
						sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);
						sourceBuffer.addEventListener('updateend', () => {
							if (mediaSource && mediaSource.readyState === 'open' && sourceBuffer && !sourceBuffer.updating) {
								// If there's more data to append, do it here.
								// This is a simplified example. Real implementations manage buffer queues.
							}
						});
					} else {
						console.error('Unsupported MIME type or codec:', mimeCodec);
					}
				}
			});
		}
	};

	ws.onmessage = (event) => {
		if (sourceBuffer && !sourceBuffer.updating) {
			const data = new Uint8Array(event.data); // Assuming binary data
			sourceBuffer.appendBuffer(data);
		}
	};

	ws.onclose = () => {
		console.log('WebSocket disconnected.');
		stopStream();
	};

	ws.onerror = (error) => {
		console.error('WebSocket error:', error);
		stopStream();
	};
};

const stopStream = () => {
	if (ws) {
		ws.close();
		ws = null;
	}
	if (videoRef.value) {
		videoRef.value.src = '';
		videoRef.value.load();
	}
	if (mediaSource && mediaSource.readyState === 'open') {
		mediaSource.endOfStream();
	}
	mediaSource = null;
	sourceBuffer = null;
	console.log('Stream stopped.');
};

onBeforeUnmount(() => {
	stopStream();
});
</script>
<template>
	<div class="camera-stream">
		<h3>Stream for {{ rtspUrl }}</h3>
		<video ref="videoRef" controls autoplay muted></video>
		<button @click="startStream">Start Stream</button>
		<button @click="stopStream">Stop Stream</button>
		<div v-if="onvifControlAvailable" class="onvif-controls">
			<h4>ONVIF PTZ Controls</h4>
			<div class="ptz-buttons">
				<button @mousedown="sendPtzCommand('moveUp')" @mouseup="sendPtzCommand('stop')">Up</button>
				<button @mousedown="sendPtzCommand('moveLeft')" @mouseup="sendPtzCommand('stop')">Left</button>
				<button @mousedown="sendPtzCommand('moveRight')" @mouseup="sendPtzCommand('stop')">Right</button>
				<button @mousedown="sendPtzCommand('moveDown')" @mouseup="sendPtzCommand('stop')">Down</button>
				<button @mousedown="sendPtzCommand('zoomIn')" @mouseup="sendPtzCommand('stop')">Zoom In</button>
				<button @mousedown="sendPtzCommand('zoomOut')" @mouseup="sendPtzCommand('stop')">Zoom Out</button>
			</div>
		</div>
	</div>
</template>
<style scoped>
.camera-stream {
	margin-top: 20px;
	border: 1px solid #eee;
	padding: 10px;
	border-radius: 8px;
	background-color: #f0f0f0;
}

.onvif-controls {
	margin-top: 20px;
	padding: 10px;
	border: 1px solid #ddd;
	border-radius: 8px;
	background-color: #e9e9e9;
}

.ptz-buttons button {
	margin: 5px;
	background-color: #6c757d;
}

.ptz-buttons button:hover {
	background-color: #5a6268;
}

video {
	width: 100%;
	max-width: 640px;
	display: block;
	margin: 10px 0;
	background-color: black;
}

button {
	margin-right: 10px;
	padding: 8px 12px;
	background-color: #007bff;
	color: white;
	border: none;
	border-radius: 4px;
	cursor: pointer;
}

button:hover {
	background-color: #0056b3;
}
</style>
