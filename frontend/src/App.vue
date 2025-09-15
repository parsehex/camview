<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
import { ref, onMounted, onUnmounted } from 'vue';
import { AlarmClock, AlarmClockOff } from 'lucide-vue-next';

const currentTime = ref(new Date());
const showTime = ref(true);

function updateTime() {
  currentTime.value = new Date();
}

function toggleTimeDisplay() {
  showTime.value = !showTime.value;
  localStorage.setItem('showTimeDisplay', showTime.value.toString());
}

let timeInterval: number;

onMounted(() => {
  // Load showTime preference from localStorage
  const savedPreference = localStorage.getItem('showTimeDisplay');
  if (savedPreference !== null) {
    showTime.value = savedPreference === 'true';
  }

  timeInterval = setInterval(updateTime, 1000);
});

onUnmounted(() => {
  clearInterval(timeInterval);
});
</script>
<template>
  <header class="leading-normal max-h-screen lg:flex lg:items-center lg:justify-center lg:pr-4">
    <div class="flex items-center">
      <RouterLink to="/" class="mx-8">
        <img alt="Vue logo" class="block" src="@/assets/logo.svg" width="50" height="50" />
      </RouterLink>
      <div class="wrapper lg:flex lg:items-start lg:flex-wrap">
        <nav class="w-full text-xs text-center mt-8 lg:text-left lg:-ml-4 lg:py-4 lg:mt-4">
          <RouterLink to="/"
            class="inline-block px-4 border-l border-gray-300 text-gray-900 router-link-exact-active:text-green-500 router-link-exact-active:hover:bg-transparent">
            Home</RouterLink>
          <RouterLink to="/settings"
            class="inline-block px-4 border-l border-gray-300 text-gray-900 router-link-exact-active:text-green-500 router-link-exact-active:hover:bg-transparent">
            Settings</RouterLink>
        </nav>
      </div>
    </div>
    <div class="flex flex-col items-center justify-center ml-4">
      <div v-if="showTime" class="time-display text-3xl text-gray-600 font-mono font-bold px-4 py-2"> {{
        currentTime.toLocaleTimeString() }} </div>
      <button @click="toggleTimeDisplay" class="text-gray-500 hover:text-gray-700 p-1"
        :title="showTime ? 'Hide time' : 'Show time'">
        <AlarmClockOff v-if="showTime" class="w-4 h-4" />
        <AlarmClock v-else class="w-4 h-4" />
      </button>
    </div>
  </header>
  <RouterView />
</template>
