<script setup>
import Sidebar from '@/components/Sidebar.vue';
</script>

<template>
  <div class="flex">
    <Sidebar class="h-screen"/>
    <div class="flex-1 p-10">
      <router-view />
    </div>
  </div>
  
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
