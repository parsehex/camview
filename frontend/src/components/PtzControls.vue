<script setup lang="ts">
import { defineProps, ref } from 'vue';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Plus, Minus, StopCircle } from 'lucide-vue-next';

const props = defineProps<{
	cameraId: number;
	sendPtzCommand: (command: string, speed?: number) => Promise<void>;
}>();

const onvifControlAvailable = ref(true); // This will be passed from parent or determined here if needed

</script>
<template>
	<div v-if="onvifControlAvailable" class="ptz-controls-container">
		<div class="ptz-dial">
			<button @mousedown="props.sendPtzCommand('moveUp')" @mouseup="props.sendPtzCommand('stop')" class="ptz-button up">
				<ArrowUp />
			</button>
			<button @mousedown="props.sendPtzCommand('moveLeft')" @mouseup="props.sendPtzCommand('stop')"
				class="ptz-button left">
				<ArrowLeft />
			</button>
			<button @mousedown="props.sendPtzCommand('stop')" class="ptz-button stop">
				<StopCircle />
			</button>
			<button @mousedown="props.sendPtzCommand('moveRight')" @mouseup="props.sendPtzCommand('stop')"
				class="ptz-button right">
				<ArrowRight />
			</button>
			<button @mousedown="props.sendPtzCommand('moveDown')" @mouseup="props.sendPtzCommand('stop')"
				class="ptz-button down">
				<ArrowDown />
			</button>
		</div>
		<div class="zoom-controls">
			<button @mousedown="props.sendPtzCommand('zoomIn')" @mouseup="props.sendPtzCommand('stop')"
				class="ptz-button zoom-in">
				<Plus />
			</button>
			<button @mousedown="props.sendPtzCommand('zoomOut')" @mouseup="props.sendPtzCommand('stop')"
				class="ptz-button zoom-out">
				<Minus />
			</button>
		</div>
	</div>
</template>
<style scoped>
.ptz-controls-container {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 10px;
	padding-top: 50px;
	border: 1px solid #ddd;
	border-radius: 8px;
	background-color: #e9e9e9;
	gap: 15px;
}

.ptz-dial {
	display: grid;
	grid-template-columns: repeat(3, 50px);
	grid-template-rows: repeat(3, 50px);
	gap: 5px;
	justify-items: center;
	align-items: center;
	position: relative;
	width: 160px;
	/* 3*50px + 2*5px + 2*padding */
	height: 160px;
}

.ptz-button {
	width: 50px;
	height: 50px;
	display: flex;
	justify-content: center;
	align-items: center;
	border-radius: 50%;
	background-color: #6c757d;
	color: white;
	border: none;
	cursor: pointer;
	transition: background-color 0.3s ease;
	padding: 0;
}

.ptz-button:hover {
	background-color: #5a6268;
}

.ptz-button .lucide {
	width: 24px;
	height: 24px;
}

.ptz-dial .up {
	grid-column: 2;
	grid-row: 1;
}

.ptz-dial .left {
	grid-column: 1;
	grid-row: 2;
}

.ptz-dial .stop {
	grid-column: 2;
	grid-row: 2;
	background-color: #dc3545;
	/* Red for stop */
}

.ptz-dial .stop:hover {
	background-color: #c82333;
}

.ptz-dial .right {
	grid-column: 3;
	grid-row: 2;
}

.ptz-dial .down {
	grid-column: 2;
	grid-row: 3;
}

.zoom-controls {
	display: flex;
	gap: 10px;
	margin-top: 10px;
}

.zoom-controls .ptz-button {
	border-radius: 4px;
	/* Square buttons for zoom */
}
</style>
