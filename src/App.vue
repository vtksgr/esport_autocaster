<script setup>
import Sidebar from '@/components/Sidebar.vue';
</script>

<template>
  <div class="flex">
    <Sidebar class="h-screen"/>
    <div class="flex-1 px-6 pt-10">
      <router-view />
    </div>
  </div>
</template>


