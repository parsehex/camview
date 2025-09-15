<script setup lang="ts">
import { ref, onMounted } from 'vue';
import OllamaModelSelect from '../components/OllamaModelSelect.vue';

interface AppSettings {
	keep_streams_open: boolean;
	ollamaHost?: string;
	ollamaModel?: string;
}

const appSettings = ref<AppSettings>({
	keep_streams_open: false,
	ollamaHost: '127.0.0.1:11434',
	ollamaModel: 'gemma3:4b',
});
// TODO load available ollama models

const fetchAppSettings = async () => {
	try {
		const response = await fetch('http://localhost:3000/api/settings');
		const settings = await response.json();
		appSettings.value.keep_streams_open = settings.keep_streams_open === 'true';
		appSettings.value.ollamaHost = settings.ollamaHost || '';
		appSettings.value.ollamaModel = settings.ollamaModel || 'llava';
	} catch (error) {
		console.error('Error fetching app settings:', error);
	}
};

const updateSetting = async (key: keyof AppSettings) => {
	try {
		await fetch(`http://localhost:3000/api/settings/${key}`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ value: appSettings.value[key] }),
		});
		console.log(`Setting "${key}" updated:`, appSettings.value[key]);
	} catch (error) {
		console.error(`Error updating ${key} setting:`, error);
	}
};

onMounted(async () => {
	await fetchAppSettings();
});
</script>
<template>
	<div class="p-5 max-w-4xl mx-auto">
		<h1 class="text-3xl text-gray-800 mb-8 text-center">Application Settings</h1>
		<div class="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-5">
			<h2 class="text-xl text-gray-700 mt-0 mb-5 border-b border-gray-200 pb-2.5">Stream Settings</h2>
			<div class="flex items-center mb-3.75 flex-wrap">
				<input type="checkbox" id="keepStreamsOpen" v-model="appSettings.keep_streams_open"
					@change="updateSetting('keep_streams_open')" class="mr-2.5 w-auto" />
				<label for="keepStreamsOpen" class="flex-none w-[150px] mr-2.5 font-bold text-gray-600">Keep streams open
					(improves startup performance, uses more resources)</label>
			</div>
		</div>
		<div class="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-5">
			<h2 class="text-xl text-gray-700 mt-0 mb-5 border-b border-gray-200 pb-2.5">Ollama AI Settings</h2>
			<div class="flex items-center mb-3.75 flex-wrap">
				<label for="ollamaHost" class="flex-none w-[150px] mr-2.5 font-bold text-gray-600">Ollama Host:</label>
				<input type="text" id="ollamaHost" v-model="appSettings.ollamaHost" @change="updateSetting('ollamaHost')"
					placeholder="e.g., http://localhost:11434"
					class="flex-grow p-2.5 border border-gray-300 rounded-md text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
			</div>
			<div class="flex items-center mb-3.75 flex-wrap">
				<label for="ollamaModel" class="flex-none w-[150px] mr-2.5 font-bold text-gray-600">Ollama Model:</label>
				<OllamaModelSelect :ollama-host="appSettings.ollamaHost || ''" :model="appSettings.ollamaModel || ''"
					@update:model="appSettings.ollamaModel = $event; updateSetting('ollamaModel')" class="flex-grow" />
			</div>
		</div>
	</div>
</template>
