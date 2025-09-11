import { createRouter, createWebHistory } from 'vue-router';
import CameraView from '../views/CameraView.vue';
import SettingsView from '../views/SettingsView.vue';

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{
			path: '/',
			name: 'home',
			component: CameraView,
		},
		{
			path: '/settings',
			name: 'settings',
			component: SettingsView,
		},
	],
});

export default router;
