<script setup lang="ts">
import { ref, toRefs } from 'vue';

const props = defineProps<{
	cameraId: number;
}>();
const { cameraId } = toRefs(props);

const ollamaPrompt = ref(localStorage.getItem(`ollamaPrompt-${cameraId.value}`) || '');
const ollamaResponse = ref('');
const ollamaImage = ref(''); // New ref for the image
const isQueryingOllama = ref(false);


const saveOllamaPrompt = () => {
	localStorage.setItem(`ollamaPrompt-${cameraId.value}`, ollamaPrompt.value);
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
				isCustom: true,
				prompt: ollamaPrompt.value,
				cameraId: cameraId.value,
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
</script>
<template>
	<div class="w-full max-w-[640px] p-4 mx-auto border border-gray-300 rounded-lg bg-white flex flex-col gap-2.5">
		<textarea v-model="ollamaPrompt" @input="saveOllamaPrompt" placeholder="Enter your prompt for Ollama..." rows="10"
			class="w-full p-2.5 border border-gray-300 rounded-md text-base resize-y min-h-20"></textarea>
		<button @click="queryOllama" :disabled="isQueryingOllama"
			class="self-start px-5 py-2 bg-green-500 text-white border-none rounded-md cursor-pointer transition-colors duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed">
			{{ isQueryingOllama ? 'Querying...' : 'Send Query' }} </button>
		<div v-if="ollamaResponse || ollamaImage" class="mt-3.75 p-2.5 border border-gray-200 rounded-md bg-blue-50">
			<img v-if="ollamaImage" :src="ollamaImage" alt="Query Image"
				class="max-w-full h-auto mb-2.5 rounded-md border border-gray-300" />
			<p class="whitespace-pre-wrap">{{ ollamaResponse }}</p>
		</div>
	</div>
</template>
