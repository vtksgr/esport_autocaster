<!-- C:\comworks\esports-autocaster\src\ui\ObsProgramDisplay.vue -->
<template>
  <div class="bg-slate-700 rounded-lg p-4 space-y-2">
    <div class="text-sm text-white/80">OBS Program Feed</div>

    <video
      ref="videoEl"
      autoplay
      playsinline
      muted
      class="w-full rounded bg-black aspect-video"
    ></video>

    <p v-if="hint"  class="text-xs text-yellow-300">{{ hint }}</p>
    <p v-if="error" class="text-xs text-red-300">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import {
  hint, error,
  setVideoElement,
  bootstrapProgramPreview,
  attachStream,
  cleanupProgramPreview,
} from "@/controllers/obs.program.display.controller.js";

const videoEl = ref(null);

onMounted(async () => {
  setVideoElement(videoEl.value);
  await bootstrapProgramPreview();
  // If you want to be extra-safe when Virtual Cam starts later elsewhere,
  // you could also call attachStream() after your auto-start hook runs.
});

onUnmounted(() => {
  cleanupProgramPreview();
});
</script>
