<script setup lang="ts">
import { ref, watch } from 'vue';

interface Camera {
	id?: number;
	name: string;
	rtspUrl: string;
	onvifUrl?: string;
	username?: string;
	password?: string;
}

const props = defineProps<{
	camera: Camera;
}>();

const emit = defineEmits<{
	(e: 'save', camera: Camera): void;
	(e: 'cancel'): void;
}>();

const editingCamera = ref<Camera>({ ...props.camera });

// Update local copy when prop changes
watch(() => props.camera, (newCamera) => {
	editingCamera.value = { ...newCamera };
}, { deep: true });

const handleSave = () => {
	emit('save', editingCamera.value);
};

const handleCancel = () => {
	emit('cancel');
};
</script>
<template>
	<div class="mt-2.5 p-2.5 border border-gray-300 rounded-md bg-white">
		<h3 class="text-lg font-semibold mb-2">Edit Camera</h3>
		<div class="mb-2.5">
			<label :for="`editName-${editingCamera.id}`" class="block mb-1.25 font-bold">Name:</label>
			<input type="text" :id="`editName-${editingCamera.id}`" v-model="editingCamera.name" required
				class="w-full p-2 border border-gray-300 rounded" />
		</div>
		<div class="mb-2.5">
			<label :for="`editRtspUrl-${editingCamera.id}`" class="block mb-1.25 font-bold">RTSP URL:</label>
			<input type="text" :id="`editRtspUrl-${editingCamera.id}`" v-model="editingCamera.rtspUrl" required
				class="w-full p-2 border border-gray-300 rounded" />
		</div>
		<div class="mb-2.5">
			<label :for="`editOnvifUrl-${editingCamera.id}`" class="block mb-1.25 font-bold">ONVIF URL (Optional):</label>
			<input type="text" :id="`editOnvifUrl-${editingCamera.id}`" v-model="editingCamera.onvifUrl"
				class="w-full p-2 border border-gray-300 rounded" />
		</div>
		<div class="mb-2.5">
			<label :for="`editUsername-${editingCamera.id}`" class="block mb-1.25 font-bold">Username:</label>
			<input type="text" :id="`editUsername-${editingCamera.id}`" v-model="editingCamera.username" required
				class="w-full p-2 border border-gray-300 rounded" />
		</div>
		<div class="mb-2.5">
			<label :for="`editPassword-${editingCamera.id}`" class="block mb-1.25 font-bold">Password:</label>
			<input type="password" :id="`editPassword-${editingCamera.id}`" v-model="editingCamera.password" required
				class="w-full p-2 border border-gray-300 rounded" />
		</div>
		<button @click="handleSave"
			class="bg-blue-600 text-white px-3.75 py-2.5 border-none rounded cursor-pointer text-base hover:bg-blue-700 mr-2.5">Save</button>
		<button @click="handleCancel"
			class="bg-gray-600 text-white px-3.75 py-2.5 border-none rounded cursor-pointer text-base hover:bg-gray-700">Cancel</button>
	</div>
</template>
