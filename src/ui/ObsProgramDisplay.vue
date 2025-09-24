<!-- C:\comworks\esports-autocaster\src\ui\ObsProgramDisplay.vue -->
<template>
  <div class="bg-slate-700 w-full h-96 rounded-lg p-4 space-y-2">
  

    <video
      ref="videoEl"
      autoplay
      playsinline
      muted
      class="w-full rounded bg-black aspect-video"
    ></video>
    <RtmpStatus />
    <p v-if="hint"  class="text-xs text-yellow-300">{{ hint }}</p>
    <p v-if="error" class="text-xs text-red-300">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import RtmpStatus from "./RtmpStatus.vue";
import {
  hint, error,
  setVideoElement,
  bootstrapProgramPreview,
  attachStream,
  cleanupProgramPreview,
} from "@/controllers/obs.program.display.controller.js";

const videoEl = ref(null);
let off;

onMounted(async () => {
  setVideoElement(videoEl.value);
  await bootstrapProgramPreview();
  // If virtual cam is started after mount, attach the stream automatically:
  off = window.api.on("obs:virtualcam:changed", (s) => {
    if (s?.outputActive) attachStream();
    else cleanupProgramPreview();
  });
});

onUnmounted(() => {
  cleanupProgramPreview();
  off?.();
});
</script>
