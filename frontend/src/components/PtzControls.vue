<script setup lang="ts">
import { defineProps, ref } from 'vue';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Plus, Minus, StopCircle } from 'lucide-vue-next';

const props = defineProps<{
	cameraId: number;
	sendPtzCommand: (command: string, speed?: number) => Promise<void>;
}>();

const onvifControlAvailable = ref(true); // This will be passed from parent or determined here if needed

const getPtzButtonClasses = (isStopButton: boolean = false, isZoomButton: boolean = false) => {
	const baseClasses = 'w-12.5 h-12.5 flex justify-center items-center text-white border-none cursor-pointer transition-colors duration-300 ease-in-out p-0';
	const shapeClasses = isZoomButton ? 'rounded' : 'rounded-full';
	const colorClasses = isStopButton ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700';
	return `${baseClasses} ${shapeClasses} ${colorClasses}`;
};
</script>
<template>
	<div v-if="onvifControlAvailable"
		class="flex flex-col items-center p-2.5 pt-12.5 border border-gray-300 rounded-lg bg-gray-200 gap-3.75">
		<div class="grid grid-cols-3 grid-rows-3 gap-1.25 justify-items-center items-center relative w-40 h-40">
			<button @mousedown="props.sendPtzCommand('moveUp')" @mouseup="props.sendPtzCommand('stop')"
				:class="[getPtzButtonClasses(), 'col-start-2 row-start-1']">
				<ArrowUp class="w-6 h-6" />
			</button>
			<button @mousedown="props.sendPtzCommand('moveLeft')" @mouseup="props.sendPtzCommand('stop')"
				:class="[getPtzButtonClasses(), 'col-start-1 row-start-2']">
				<ArrowLeft class="w-6 h-6" />
			</button>
			<button @mousedown="props.sendPtzCommand('stop')" :class="[getPtzButtonClasses(true), 'col-start-2 row-start-2']">
				<StopCircle class="w-6 h-6" />
			</button>
			<button @mousedown="props.sendPtzCommand('moveRight')" @mouseup="props.sendPtzCommand('stop')"
				:class="[getPtzButtonClasses(), 'col-start-3 row-start-2']">
				<ArrowRight class="w-6 h-6" />
			</button>
			<button @mousedown="props.sendPtzCommand('moveDown')" @mouseup="props.sendPtzCommand('stop')"
				:class="[getPtzButtonClasses(), 'col-start-2 row-start-3']">
				<ArrowDown class="w-6 h-6" />
			</button>
		</div>
		<div class="flex gap-2.5 mt-2.5">
			<button @mousedown="props.sendPtzCommand('zoomIn')" @mouseup="props.sendPtzCommand('stop')"
				:class="getPtzButtonClasses(false, true)">
				<Plus class="w-6 h-6" />
			</button>
			<button @mousedown="props.sendPtzCommand('zoomOut')" @mouseup="props.sendPtzCommand('stop')"
				:class="getPtzButtonClasses(false, true)">
				<Minus class="w-6 h-6" />
			</button>
		</div>
	</div>
</template>
