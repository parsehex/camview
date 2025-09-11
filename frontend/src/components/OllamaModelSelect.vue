<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { Ollama } from 'ollama/browser';

const props = defineProps<{
	ollamaHost: string;
	model: string;
}>();

const emit = defineEmits(['update:model']);

const availableModels = ref<string[]>([]);
const internalModel = ref(props.model); // Use an internal ref to manage the input/select value
const error = ref(false);

const fetchModels = async () => {
	error.value = false;
	availableModels.value = [];
	if (!props.ollamaHost) {
		return;
	}

	try {
		const ollamaClient = new Ollama({ host: props.ollamaHost });
		const response = await ollamaClient.list();
		availableModels.value = response.models.map((m: any) => m.name);
	} catch (e) {
		console.error('Error fetching Ollama models:', e);
		error.value = true;
	}
};

watch(() => props.ollamaHost, fetchModels, { immediate: true });

// Watch for external model changes and update internalModel
watch(() => props.model, (newModel) => {
	internalModel.value = newModel;
});

const onModelChange = () => {
	emit('update:model', internalModel.value);
};

onMounted(() => {
	fetchModels();
});
</script>
<template>
	<div class="ollama-model-select-container">
		<input type="text" v-model="internalModel" @change="onModelChange" :class="{ 'error-border': error }"
			placeholder="Enter model name" />
		<select v-model="internalModel" @change="onModelChange" :class="{ 'error-border': error }">
			<option value="" disabled>Select an Ollama model</option>
			<option v-for="modelName in availableModels" :key="modelName" :value="modelName"> {{ modelName }} </option>
		</select>
		<p v-if="error" class="error-message">Failed to load models. Check Ollama host.</p>
	</div>
</template>
<style scoped>
.ollama-model-select-container {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
	flex-grow: 1;
}

.ollama-model-select-container select,
.ollama-model-select-container input[type="text"] {
	flex-grow: 1;
	padding: 8px 12px;
	border: 1px solid #ccc;
	border-radius: 5px;
	font-size: 1rem;
	min-width: 150px;
	/* Ensure inputs don't get too small */
}

.ollama-model-select-container select.error-border,
.ollama-model-select-container input[type="text"].error-border {
	border-color: red;
	box-shadow: 0 0 0 2px rgba(255, 0, 0, 0.25);
}

.ollama-model-select-container select:focus,
.ollama-model-select-container input[type="text"]:focus {
	border-color: #007bff;
	outline: none;
	box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.error-message {
	color: red;
	font-size: 0.85rem;
	margin-top: 5px;
	flex-basis: 100%;
	/* Occupy full width below other elements */
	text-align: right;
	padding-right: 10px;
}
</style>
