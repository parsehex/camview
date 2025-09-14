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
	<div class="ollama-controls">
		<textarea v-model="ollamaPrompt" @input="saveOllamaPrompt" placeholder="Enter your prompt for Ollama..."
			rows="10"></textarea>
		<button @click="queryOllama" :disabled="isQueryingOllama"> {{ isQueryingOllama ? 'Querying...' : 'Send Query' }}
		</button>
		<div v-if="ollamaResponse || ollamaImage" class="ollama-response">
			<img v-if="ollamaImage" :src="ollamaImage" alt="Query Image" class="ollama-query-image" />
			<p>{{ ollamaResponse }}</p>
		</div>
	</div>
</template>
