<template>
  <div class="flex items-center justify-between bg-slate-800 rounded p-2  border border-slate-600 w-48">
        <span
      class="w-3.5 h-3.5 rounded-full"
      :class="{
        'bg-green-500': state === 'connected',
        'bg-yellow-400': state === 'unstable',
        'bg-gray-400': state === 'disconnected'
      }"
    />
    <div class="flex flex-col">
      <span class="text-xs font-semibold text-slate-400">OBS接続状況</span>
      <!-- <span
        class="text-xs mt-0.5"
        :class="{
          'text-green-600': state === 'connected',
          'text-yellow-600': state === 'unstable',
          'text-gray-500': state === 'disconnected'
        }"
      >
        {{ label }}
      </span> -->
    </div>


  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from "vue";
import { state, label, startStatusWatcher } from "@/controllers/obs.connect.status.js";

let cleanup;
onMounted(() => {
  cleanup = startStatusWatcher();
});

onUnmounted(() => {
  cleanup?.();
});
</script>