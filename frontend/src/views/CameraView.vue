<script setup lang="ts">
import { ref, onMounted } from 'vue';
import CameraStream from '../components/CameraStream.vue';

interface AppSettings {
	keep_streams_open: boolean;
}

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
const appSettings = ref<AppSettings>({ keep_streams_open: false });

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

const fetchAppSettings = async () => {
	try {
		const response = await fetch('http://localhost:3000/api/settings/keep-streams-open');
		appSettings.value = await response.json();
	} catch (error) {
		console.error('Error fetching app settings:', error);
	}
};

const updateKeepStreamsOpenSetting = async () => {
	try {
		await fetch('http://localhost:3000/api/settings/keep-streams-open', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ value: appSettings.value.keep_streams_open }),
		});
		console.log('Keep streams open setting updated:', appSettings.value.keep_streams_open);
	} catch (error) {
		console.error('Error updating keep_streams_open setting:', error);
	}
};

onMounted(async () => {
	await fetchCameras();
	await fetchAppSettings();
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
	<div class="camera-view">
		<h1>Camera Management</h1>
		<div class="app-settings" v-if="false">
			<h2>Application Settings</h2>
			<div>
				<!-- doesn't work especially well -->
				<input type="checkbox" id="keepStreamsOpen" v-model="appSettings.keep_streams_open"
					@change="updateKeepStreamsOpenSetting" />
				<label for="keepStreamsOpen">Keep streams open (improves startup performance, uses more resources)</label>
			</div>
		</div>
		<div v-if="cameras.length" class="camera-list">
			<ul>
				<li v-for="camera in cameras" :key="camera.id">
					<div v-if="editingCamera && editingCamera.id === camera.id" class="edit-form">
						<h3>Edit Camera</h3>
						<div>
							<label :for="`editName-${camera.id}`">Name:</label>
							<input type="text" :id="`editName-${camera.id}`" v-model="editingCamera.name" required />
						</div>
						<div>
							<label :for="`editRtspUrl-${camera.id}`">RTSP URL:</label>
							<input type="text" :id="`editRtspUrl-${camera.id}`" v-model="editingCamera.rtspUrl" required />
						</div>
						<div>
							<label :for="`editOnvifUrl-${camera.id}`">ONVIF URL (Optional):</label>
							<input type="text" :id="`editOnvifUrl-${camera.id}`" v-model="editingCamera.onvifUrl" />
						</div>
						<div>
							<label :for="`editUsername-${camera.id}`">Username:</label>
							<input type="text" :id="`editUsername-${camera.id}`" v-model="editingCamera.username" required />
						</div>
						<div>
							<label :for="`editPassword-${camera.id}`">Password:</label>
							<input type="password" :id="`editPassword-${camera.id}`" v-model="editingCamera.password" required />
						</div>
						<button @click="saveCamera">Save</button>
						<button @click="cancelEdit">Cancel</button>
					</div>
					<div v-else> {{ camera.name }} ({{ camera.rtspUrl }}) <button @click="editCamera(camera)">Edit</button>
						<button @click="deleteCamera(camera.id)" class="delete-button">Delete</button>
						<CameraStream v-if="camera.id" :camera-id="camera.id" :rtsp-url="camera.rtspUrl" />
					</div>
				</li>
			</ul>
		</div>
		<div class="form-and-discovery-container">
			<div class="add-camera">
				<h2>Add a Camera</h2>
				<form @submit.prevent="addCamera">
					<div>
						<label for="newName">Name:</label>
						<input type="text" id="newName" v-model="newCamera.name" required />
					</div>
					<div>
						<label for="newHost">Host (IP or Domain):</label>
						<input type="text" id="newHost" placeholder="127.0.0.1" v-model="newCamera.rtspUrl" required />
					</div>
					<div>
						<label for="newUsername">Username:</label>
						<input type="text" id="newUsername" v-model="newCamera.username" />
					</div>
					<div>
						<label for="newPassword">Password:</label>
						<input type="password" id="newPassword" v-model="newCamera.password" />
					</div>
					<button type="submit">Add</button>
				</form>
			</div>
			<div class="onvif-discovery">
				<h2>Discover Cameras</h2>
				<button @click="discoverOnvifDevices">Discover Devices</button>
				<ul>
					<li v-for="device in discoveredDevices" :key="device.urn" @click="selectDevice(device)"> {{ device.name }} {{
						device.xaddrs.join(', ') }} </li>
				</ul>
			</div>
		</div>
	</div>
</template>
<style scoped>
.app-settings {
	margin-bottom: 30px;
	padding: 15px;
	border: 1px solid #ccc;
	border-radius: 8px;
	background-color: #f9f9f9;
}

.app-settings h2 {
	color: #333;
	margin-bottom: 15px;
}

.app-settings div {
	display: flex;
	align-items: center;
	gap: 10px;
}

.app-settings input[type="checkbox"] {
	width: auto;
	margin-right: 5px;
}

.form-and-discovery-container {
	display: flex;
	gap: 30px;
	width: 100%;
	/* Space between the form and discovery sections */
	align-items: flex-start;
	/* Align items to the top */
	margin-bottom: 30px;
}

.add-camera {
	flex-grow: 1;
}

.add-camera,
.camera-list {
	margin-bottom: 30px;
	padding: 15px;
	border: 1px solid #ccc;
	border-radius: 8px;
}

.edit-form {
	margin-top: 10px;
	padding: 10px;
	border: 1px solid #ddd;
	border-radius: 5px;
	background-color: #fefefe;
}

.edit-form button {
	margin-right: 10px;
	background-color: #007bff;
}

.edit-form button:hover {
	background-color: #0056b3;
}

.delete-button {
	background-color: #dc3545;
	margin-left: 10px;
}

.delete-button:hover {
	background-color: #c82333;
}

.add-camera h2,
.camera-list h2,
.onvif-discovery h2 {
	color: #333;
	margin-bottom: 15px;
}

.onvif-discovery {
	padding: 15px;
	border: 1px solid #ccc;
	border-radius: 8px;
}

form div {
	margin-bottom: 10px;
}

label {
	display: block;
	margin-bottom: 5px;
	font-weight: bold;
}

input[type="text"] {
	width: 100%;
	padding: 8px;
	border: 1px solid #ddd;
	border-radius: 4px;
}

button {
	background-color: #4CAF50;
	color: white;
	padding: 10px 15px;
	border: none;
	border-radius: 4px;
	cursor: pointer;
	font-size: 16px;
}

button:hover {
	background-color: #45a049;
}

ul {
	list-style: none;
	padding: 0;
}

li {
	border: 1px solid #eee;
	padding: 10px;
	margin-bottom: 8px;
	border-radius: 4px;
}
</style>
