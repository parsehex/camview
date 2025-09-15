<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>
<template>
  <header class="leading-normal max-h-screen lg:flex lg:items-center lg:pr-4">
    <RouterLink to="/">
      <img alt="Vue logo" class="block mx-auto mb-8 lg:mr-8 lg:mx-0" src="@/assets/logo.svg" width="50" height="50" />
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
  </header>
  <RouterView />
</template>
