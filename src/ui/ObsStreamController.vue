<!-- esports-autocaster\src\ui\ObsStreamController.vue -->
<template>
  <div class="bg-slate-700 shadow rounded p-2  border border-slate-600">
    <div class="flex items-center justify-between ">
      <button
        type="button"
        :class="streamButtonClass"
        :disabled="loading"
        @click="toggleStream"
        :aria-pressed="isStreaming ? 'true' : 'false'"
      >
        <span v-if="loading" class="text-xs">Please wait…</span>
        <span v-else>{{ streamButtonText }}</span>
      </button>
    </div>

    <p v-if="lastError" class="text-xs text-red-600 mt-2">{{ lastError }}</p>
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