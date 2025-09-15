<script setup lang="ts">
import { ref, onMounted } from 'vue';
import CameraStream from '../components/CameraStream.vue';

interface Camera {
	id?: number;
	name: string;
	rtspUrl: string;
	onvifUrl?: string;
	username?: string;
	password?: string;
}

const cameras = ref<Camera[]>([]);
const newCamera = ref<Camera>({ name: '', rtspUrl: '', onvifUrl: '', username: '', password: '' });
const editingCamera = ref<Camera | null>(null); // To hold the camera being edited
const discoveredDevices = ref<any[]>([]);

const discoverOnvifDevices = async () => {
	try {
		const response = await fetch('http://localhost:3000/api/onvif/discover');
		discoveredDevices.value = await response.json();
	} catch (error) {
		console.error('Error discovering ONVIF devices:', error);
	}
};

const selectDevice = (device: any) => {
	if (device.xaddrs && device.xaddrs.length > 0) {
		try {
			const url = new URL(device.xaddrs[0]);
			newCamera.value.rtspUrl = url.hostname;
		} catch (error) {
			console.error('Error parsing device xaddr URL:', error);
			newCamera.value.rtspUrl = device.xaddrs[0]; // Fallback to full URL if parsing fails
		}
	}
};

const fetchCameras = async () => {
	try {
		const response = await fetch('http://localhost:3000/api/cameras');
		cameras.value = await response.json();
	} catch (error) {
		console.error('Error fetching cameras:', error);
	}
};

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
		cameras.value.push(addedCamera);
		newCamera.value = { name: '', rtspUrl: '', onvifUrl: '', username: '', password: '' }; // Clear form
	} catch (error) {
		console.error('Error adding camera:', error);
	}
};

const editCamera = (camera: Camera) => {
	editingCamera.value = { ...camera }; // Create a copy to edit
};

const cancelEdit = () => {
	editingCamera.value = null;
};

const saveCamera = async () => {
	if (!editingCamera.value || !editingCamera.value.id) return;

	try {
		const response = await fetch(`http://localhost:3000/api/cameras/${editingCamera.value.id}`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(editingCamera.value),
		});
		const updatedCamera = await response.json();
		const index = cameras.value.findIndex(c => c.id === updatedCamera.id);
		if (index !== -1) {
			cameras.value[index] = updatedCamera;
		}
		editingCamera.value = null; // Exit edit mode
	} catch (error) {
		console.error('Error updating camera:', error);
	}
};

onMounted(async () => {
	await fetchCameras();
});

const deleteCamera = async (id: number | undefined) => {
	if (!id) return;
	if (!confirm('Are you sure you want to delete this camera?')) return;

	try {
		await fetch(`http://localhost:3000/api/cameras/${id}`, {
			method: 'DELETE',
		});
		cameras.value = cameras.value.filter(camera => camera.id !== id);
	} catch (error) {
		console.error('Error deleting camera:', error);
	}
};
</script>
<template>
	<div class="p-4">
		<h1 class="text-2xl font-bold mb-4">Camera Management</h1>
		<ul v-if="cameras.length" class="list-none p-0 mb-7.5">
			<li v-for="camera in cameras" :key="camera.id" class="border border-gray-200 p-2.5 mb-2 rounded">
				<div v-if="editingCamera && editingCamera.id === camera.id"
					class="mt-2.5 p-2.5 border border-gray-300 rounded-md bg-white">
					<h3 class="text-lg font-semibold mb-2">Edit Camera</h3>
					<div class="mb-2.5">
						<label :for="`editName-${camera.id}`" class="block mb-1.25 font-bold">Name:</label>
						<input type="text" :id="`editName-${camera.id}`" v-model="editingCamera.name" required
							class="w-full p-2 border border-gray-300 rounded" />
					</div>
					<div class="mb-2.5">
						<label :for="`editRtspUrl-${camera.id}`" class="block mb-1.25 font-bold">RTSP URL:</label>
						<input type="text" :id="`editRtspUrl-${camera.id}`" v-model="editingCamera.rtspUrl" required
							class="w-full p-2 border border-gray-300 rounded" />
					</div>
					<div class="mb-2.5">
						<label :for="`editOnvifUrl-${camera.id}`" class="block mb-1.25 font-bold">ONVIF URL (Optional):</label>
						<input type="text" :id="`editOnvifUrl-${camera.id}`" v-model="editingCamera.onvifUrl"
							class="w-full p-2 border border-gray-300 rounded" />
					</div>
					<div class="mb-2.5">
						<label :for="`editUsername-${camera.id}`" class="block mb-1.25 font-bold">Username:</label>
						<input type="text" :id="`editUsername-${camera.id}`" v-model="editingCamera.username" required
							class="w-full p-2 border border-gray-300 rounded" />
					</div>
					<div class="mb-2.5">
						<label :for="`editPassword-${camera.id}`" class="block mb-1.25 font-bold">Password:</label>
						<input type="password" :id="`editPassword-${camera.id}`" v-model="editingCamera.password" required
							class="w-full p-2 border border-gray-300 rounded" />
					</div>
					<button @click="saveCamera"
						class="bg-blue-600 text-white px-3.75 py-2.5 border-none rounded cursor-pointer text-base hover:bg-blue-700 mr-2.5">Save</button>
					<button @click="cancelEdit"
						class="bg-gray-600 text-white px-3.75 py-2.5 border-none rounded cursor-pointer text-base hover:bg-gray-700">Cancel</button>
				</div>
				<div v-else class="flex flex-col items-center justify-between">
					<span>{{ camera.name }} ({{ camera.rtspUrl }}) <button @click="editCamera(camera)"
							class="bg-blue-600 text-white px-3.75 py-2.5 border-none rounded cursor-pointer text-base hover:bg-blue-700 mr-2.5">Edit</button>
						<button @click="deleteCamera(camera.id)"
							class="bg-red-600 text-white px-3.75 py-2.5 border-none rounded cursor-pointer text-base hover:bg-red-700 ml-2.5">Delete</button>
					</span>
					<CameraStream v-if="camera.id" :camera-id="camera.id" :rtsp-url="camera.rtspUrl" />
				</div>
			</li>
		</ul>
		<div class="flex gap-7.5 w-full items-start mb-7.5">
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
			<div class="p-3.75 border border-gray-400 rounded-lg text-center">
				<h2 class="text-gray-800 mb-3.75">Discover Cameras</h2>
				<button @click="discoverOnvifDevices"
					class="bg-green-600 text-white px-3.75 py-2.5 border-none rounded cursor-pointer text-base hover:bg-green-700">Discover
					Devices</button>
				<ul class="list-none p-0 mt-4">
					<li v-for="device in discoveredDevices" :key="device.urn" @click="selectDevice(device)"
						class="border border-gray-200 p-2.5 mb-2 rounded cursor-pointer hover:bg-gray-100"> {{ device.name }} {{
							device.xaddrs.join(', ') }} </li>
				</ul>
			</div>
		</div>
	</div>
</template>
