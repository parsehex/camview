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
	<div class="settings-view">
		<h1>Application Settings</h1>
		<div class="setting-group">
			<h2>Stream Settings</h2>
			<div class="setting-item">
				<input type="checkbox" id="keepStreamsOpen" v-model="appSettings.keep_streams_open"
					@change="updateSetting('keep_streams_open')" />
				<label for="keepStreamsOpen">Keep streams open (improves startup performance, uses more resources)</label>
			</div>
		</div>
		<div class="setting-group">
			<h2>Ollama AI Settings</h2>
			<div class="setting-item">
				<label for="ollamaHost">Ollama Host:</label>
				<input type="text" id="ollamaHost" v-model="appSettings.ollamaHost" @change="updateSetting('ollamaHost')"
					placeholder="e.g., http://localhost:11434" />
			</div>
			<div class="setting-item">
				<label for="ollamaModel">Ollama Model:</label>
				<OllamaModelSelect :ollama-host="appSettings.ollamaHost || ''" :model="appSettings.ollamaModel || ''"
					@update:model="appSettings.ollamaModel = $event; updateSetting('ollamaModel')" />
			</div>
		</div>
	</div>
</template>
<style scoped>
.settings-view {
	padding: 20px;
	max-width: 800px;
	margin: 0 auto;
}

h1 {
	color: #333;
	margin-bottom: 30px;
	text-align: center;
}

.setting-group {
	background-color: #f9f9f9;
	border: 1px solid #eee;
	border-radius: 8px;
	padding: 20px;
	margin-bottom: 20px;
}

.setting-group h2 {
	color: #555;
	margin-top: 0;
	margin-bottom: 20px;
	border-bottom: 1px solid #eee;
	padding-bottom: 10px;
}

.setting-item {
	display: flex;
	align-items: center;
	margin-bottom: 15px;
	flex-wrap: wrap;
	/* Allow items to wrap on smaller screens */
}

.setting-item label {
	flex: 0 0 150px;
	/* Fixed width for labels */
	margin-right: 10px;
	font-weight: bold;
	color: #666;
}

.setting-item input[type="checkbox"] {
	margin-right: 10px;
	width: auto;
}

/* Adjustments for the new component */
.setting-item .ollama-model-select-container {
	flex-grow: 1;
}

.setting-item input[type="text"] {
	flex-grow: 1;
	padding: 8px 12px;
	border: 1px solid #ccc;
	border-radius: 5px;
	font-size: 1rem;
}

.setting-item input[type="text"]:focus {
	border-color: #007bff;
	outline: none;
	box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}
</style>
