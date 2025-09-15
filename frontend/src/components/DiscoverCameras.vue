<script setup lang="ts">
import { ref } from 'vue';
import Spinner from './Spinner.vue';

const emit = defineEmits(['select']);

const discoveredDevices = ref<any[]>([]);
const loading = ref(false);

const discoverOnvifDevices = async () => {
	loading.value = true;
	try {
		const response = await fetch('http://localhost:3000/api/onvif/discover');
		discoveredDevices.value = await response.json();
	} catch (error) {
		console.error('Error discovering ONVIF devices:', error);
	}
	loading.value = false;
};

const selectDevice = (device: any) => {
	if (device.xaddrs && device.xaddrs.length > 0) {
		let url = '';
		try {
			const u = new URL(device.xaddrs[0]);
			url = u.hostname;
		} catch (error) {
			console.error('Error parsing device xaddr URL:', error);
			url = device.xaddrs[0]; // Fallback to full URL if parsing fails
		}
		if (url) emit('select', url);
	}
};
</script>
<template>
	<div class="p-3.75 border border-gray-400 rounded-lg text-center">
		<h2 class="text-gray-800 mb-3.75">Discover Cameras</h2>
		<div class="relative">
			<button @click="discoverOnvifDevices"
				class="bg-green-600 text-white px-3.75 py-2.5 border-none rounded cursor-pointer text-base hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors duration-200"
				:disabled="loading">
				<span :class="{ 'opacity-0': loading }">Start Discovering</span>
				<div v-if="loading" class="absolute inset-0 flex items-center justify-center">
					<Spinner />
				</div>
			</button>
		</div>
		<ul v-if="!loading && discoveredDevices.length > 0" class="list-none p-0 mt-4">
			<li v-for="device in discoveredDevices" :key="device.urn" @click="selectDevice(device)"
				class="border border-gray-200 p-2.5 mb-2 rounded cursor-pointer hover:bg-gray-100 transition-colors duration-150">
				{{ device.name }} {{ device.xaddrs.join(', ') }} </li>
		</ul>
	</div>
</template>
