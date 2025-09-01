<template>
  <div class="bg-slate-700 rounded-lg p-4 space-y-4 shadow-md border border-slate-500">
    <div class="flex items-center justify-between">
      <div>
        <div class="text-sm font-semibold text-slate-50">シーンコレクション</div>
        <div class="text-xs text-slate-300">
          現在: {{ currentCollection || '—' }}（全 {{ collections.length }}）
        </div>
        <div v-if="lastError" class="text-xs text-red-600 mt-1 font-medium">
          {{ lastError }}
        </div>
      </div>

      <div class="flex items-center gap-2">
        <select
          v-model="selected"
          @change="onChange"
          class="border rounded px-2 py-1 text-sm text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          :disabled="connection !== 'connected' || loading || collections.length === 0"
        >
          <option v-for="name in collections" :key="name" :value="name">
            {{ name }}
          </option>
        </select>

  
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        class="px-3 py-1 rounded text-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
        @click="obs.startStream"
        :disabled="connection !== 'connected' || isStreaming"
      >
        Start Stream
      </button>

      <button
        class="px-3 py-1 rounded text-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
        @click="obs.stopStream"
        :disabled="connection !== 'connected' || !isStreaming"
      >
        Stop Stream
      </button>

      <button
        class="px-3 py-1 rounded text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        @click="obs.startRecord"
        :disabled="connection !== 'connected' || isRecording"
      >
        Start Record
      </button>

      <button
        class="px-3 py-1 rounded text-sm text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50"
        @click="obs.stopRecord"
        :disabled="connection !== 'connected' || !isRecording"
      >
        Stop Record
      </button>
    </div>
  </div>
</template>


<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import obs from "../obs/obs.controller.js";

// reactive refs from the controller
const connection        = obs.connection;
const collections       = obs.collections;
const currentCollection = obs.currentCollection;
const loading           = obs.loading;
const lastError         = obs.lastError;
const isStreaming       = obs.isStreaming;
const isRecording       = obs.isRecording;

const selected = ref("");

// switch collection when dropdown changes
function onChange() {
  if (selected.value && selected.value !== currentCollection.value) {
    obs.setCollection(selected.value);
  }
}

// keep dropdown selection in sync with OBS current collection
watch(currentCollection, (v) => { selected.value = v || ""; }, { immediate: true });

let off;
onMounted(async () => {
  off = obs.attach();
  await obs.bootstrap();  // if already connected, this fills collections/status
});
onUnmounted(() => off?.());
</script>
