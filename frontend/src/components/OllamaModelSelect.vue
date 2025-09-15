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
	<div class="flex flex-wrap gap-2.5 flex-grow">
		<input type="text" v-model="internalModel" @change="onModelChange"
			:class="['flex-grow px-3 py-2 border border-gray-400 rounded-md text-base min-w-[150px]', { 'border-red-500 ring-2 ring-red-200': error }, 'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200']"
			placeholder="Enter model name" />
		<select v-model="internalModel" @change="onModelChange"
			:class="['flex-grow px-3 py-2 border border-gray-400 rounded-md text-base min-w-[150px]', { 'border-red-500 ring-2 ring-red-200': error }, 'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200']">
			<option value="" disabled>Select an Ollama model</option>
			<option v-for="modelName in availableModels" :key="modelName" :value="modelName"> {{ modelName }} </option>
		</select>
		<p v-if="error" class="text-red-500 text-sm mt-1.25 basis-full text-right pr-2.5">Failed to load models. Check
			Ollama host.</p>
	</div>
</template>
