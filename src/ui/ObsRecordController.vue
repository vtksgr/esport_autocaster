<template>
  <div class="bg-slate-700 shadow rounded p-2 border border-slate-600">
    <button
      :class="recordButtonClass"
      :disabled="loading"
      @click="toggleRecord"
      :aria-pressed="isRecording ? 'true' : 'false'"
    >
      <span v-if="loading">Please wait…</span>
      <span v-else>{{ recordButtonText }}</span>
    </button>

    <p v-if="lastError" class="text-xs text-red-600 mt-2">{{ lastError }}</p>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import {
  isRecording, loading, lastError, bootstrap,
  toggleRecord, recordButtonText, recordButtonClass
} from "../controllers/obs.record.controller.js";

onMounted(async () => { await bootstrap(); });
</script>
