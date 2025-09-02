<template>
  <div class="bg-slate-700 shadow rounded p-2 space-y-3 border border-slate-600 w-110">
    <div class="flex items-center justify-between">
      <div>
        <div class="text-sm font-semibold">シーンコレクション</div>
        <div class="text-xs text-slate-300">{{ currentCollection || '—' }}</div>
      </div>

      <select
        v-model="selected"
        @change="onChange"
        class="border border-slate-500 rounded px-2 py-1 text-sm bg-slate-600 text-slate-300"
        :disabled="connection !== 'connected' || loading || !collections.length"
      >
        <option v-for="name in collections" :key="name" :value="name">
          {{ name }}
        </option>
      </select>
    </div>

    <p v-if="lastError" class="text-xs text-red-400">{{ lastError }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import {
  connection, collections, currentCollection, loading, lastError,
  attach, bootstrap, setCollection
} from "../controllers/obs.scene.controller.js";

const selected = ref("");

// keep cleanup handles in outer scope so we can register onUnmounted synchronously
let off = null;
let unwatch = null;

// register the unmount hook at setup-time (no awaits before this line)
onUnmounted(() => {
  off?.();        // detach OBS state listener
  unwatch?.();    // stop the watcher
});

onMounted(async () => {
  // start listening to OBS connection/state changes
  off = attach();

  // do async bootstrap safely here
  try {
    await bootstrap();
  } catch (_) {
    /* ignore */
  }

  // initialize the dropdown with current collection
  selected.value = currentCollection.value;

  // sync reactive store -> local selected
  unwatch = watch(currentCollection, (v) => {
    if (v !== selected.value) selected.value = v;
  });
});

async function onChange() {
  if (selected.value && selected.value !== currentCollection.value) {
    await setCollection(selected.value);
  }
}
</script>
