<!-- esports-autocaster\src\ui\ObsStreamController.vue -->
<template>
 
    <div class="flex items-center justify-between ">
      <button
        type="button"
        :class="streamButtonClass"
        :disabled="loading"
        @click="toggleStream"
        :aria-pressed="isStreaming ? 'true' : 'false'"
      >
        <span v-if="loading" class="text-[10px]">Please wait…</span>
        <span v-else class="text-xs font-semibold">{{ streamButtonText }}</span>
      </button>

    <p v-if="lastError" class="text-[10px] text-red-600 mt-2">{{ lastError }}</p>
  </div>
</template>
<script setup>
import { onMounted } from "vue";
import {
  isStreaming, loading, lastError, bootstrap,
  toggleStream, streamButtonText, streamButtonClass
} from "@/controllers/obs.stream.controller.js";


onMounted(async () => { await bootstrap(); });
</script>