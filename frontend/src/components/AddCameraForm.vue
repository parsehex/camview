<script setup lang="ts">
import { ref } from 'vue';
import DiscoverCameras from './DiscoverCameras.vue';

interface Camera {
	name: string;
	rtspUrl: string;
	username?: string;
	password?: string;
}

const emit = defineEmits<{
	(e: 'camera-added'): void;
}>();

const newCamera = ref<Camera>({ name: '', rtspUrl: '', username: '', password: '' });

const addCamera = async () => {
	try {
		// Assuming newCamera.rtspUrl is now used for the host input
		const response = await fetch('http://localhost:3000/api/cameras', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				name: newCamera.value.name,
				host: newCamera.value.rtspUrl, // This is actually the host for ONVIF discovery
				username: newCamera.value.username,
				password: newCamera.value.password
			}),
		});
		const addedCamera = await response.json();
		// Clear form after successful addition
		newCamera.value = { name: '', rtspUrl: '', username: '', password: '' };
		// Emit event to notify parent component
		emit('camera-added');
	} catch (error) {
		console.error('Error adding camera:', error);
	}
};
</script>
<template>
	<div class="flex-grow p-3.75 border border-gray-400 rounded-lg">
		<h2 class="text-gray-800 mb-3.75">Add a Camera</h2>
		<form @submit.prevent="addCamera">
			<div class="mb-2.5">
				<label for="newName" class="block mb-1.25 font-bold">Name:</label>
				<input type="text" id="newName" v-model="newCamera.name" required
					class="w-full p-2 border border-gray-300 rounded" />
			</div>
			<div class="mb-2.5">
				<label for="newHost" class="block mb-1.25 font-bold">Host (IP or Domain):</label>
				<input type="text" id="newHost" placeholder="127.0.0.1" v-model="newCamera.rtspUrl" required
					class="w-full p-2 border border-gray-300 rounded" />
			</div>
			<div class="mb-2.5">
				<label for="newUsername" class="block mb-1.25 font-bold">Username:</label>
				<input type="text" id="newUsername" v-model="newCamera.username"
					class="w-full p-2 border border-gray-300 rounded" />
			</div>
			<div class="mb-2.5">
				<label for="newPassword" class="block mb-1.25 font-bold">Password:</label>
				<input type="password" id="newPassword" v-model="newCamera.password"
					class="w-full p-2 border border-gray-300 rounded" />
			</div>
			<button type="submit"
				class="bg-green-600 text-white px-3.75 py-2.5 border-none rounded cursor-pointer text-base hover:bg-green-700">Add</button>
		</form>
	</div>
	<DiscoverCameras @select="newCamera.rtspUrl = $event" />
</template>
