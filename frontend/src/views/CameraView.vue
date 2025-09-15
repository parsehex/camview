<script setup lang="ts">
import { ref, onMounted } from 'vue';
import CameraStream from '@/components/CameraStream.vue';
import AddCameraForm from '@/components/AddCameraForm.vue';
import EditCameraForm from '@/components/EditCameraForm.vue';

interface Camera {
	id?: number;
	name: string;
	rtspUrl: string;
	onvifUrl?: string;
	username?: string;
	password?: string;
}

const cameras = ref<Camera[]>([]);
const editingCamera = ref<Camera | null>(null);

const fetchCameras = async () => {
	try {
		const response = await fetch('http://localhost:3000/api/cameras');
		cameras.value = await response.json();
	} catch (error) {
		console.error('Error fetching cameras:', error);
	}
};

const editCamera = (camera: Camera) => {
	editingCamera.value = { ...camera }; // Create a copy to edit
};

const cancelEdit = () => {
	editingCamera.value = null;
};

const saveCamera = async (camera: Camera) => {
	if (!camera.id) return;

	try {
		const response = await fetch(`http://localhost:3000/api/cameras/${camera.id}`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(camera),
		});
		const updatedCamera = await response.json();
		const index = cameras.value.findIndex(c => c.id?.toString() === updatedCamera.id?.toString());
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
				<EditCameraForm v-if="editingCamera && editingCamera.id === camera.id" :camera="camera" @save="saveCamera"
					@cancel="cancelEdit" />
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
			<AddCameraForm @camera-added="fetchCameras" />
		</div>
	</div>
</template>
