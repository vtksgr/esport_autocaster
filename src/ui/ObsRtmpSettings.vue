<!-- src/ui/ObsRtmpSettings.vue -->
<template>
  <div class="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
    <h3 class="text-slate-100 font-semibold text-lg">RTMP(S) Stream Settings</h3>

    <!-- Platform -->
    <div class="flex flex-col gap-1">
      <label class="text-sm text-slate-300">Platform</label>
      <select
        class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100"
        :disabled="loading"
        v-model="selectedPlatform"
        @change="onPlatformChange"
      >
        <option v-for="p in presets" :key="p.id" :value="p.id">{{ p.label }}</option>
      </select>
      <p class="text-xs text-slate-400">
        Selecting YouTube/Twitch/Facebook auto-fills and locks the server URL.
        Choose Custom to enter any RTMP/S server.
      </p>
    </div>

    <!-- Server URL -->
    <div class="flex flex-col gap-1">
      <label class="text-sm text-slate-300">Server URL</label>
      <input
        class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100"
        :readonly="readonlyServer"
        :aria-readonly="readonlyServer ? 'true' : 'false'"
        :disabled="loading"
        v-model.trim="server"
        placeholder="rtmp://..."
      />
      <p class="text-xs" :class="readonlyServer ? 'text-slate-500' : 'text-slate-400'">
        {{ readonlyServer ? 'Preset URL (read-only)' : 'Enter your RTMP/S server URL' }}
      </p>
    </div>

    <!-- Stream Key -->
    <div class="flex flex-col gap-1">
      <label class="text-sm text-slate-300">Stream Key</label>
      <input
        class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100"
        :disabled="loading"
        v-model.trim="key"
        type="password"
        placeholder="live_XXXXXXXX..."
        autocomplete="off"
      />
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2 pt-1">
      <button
        class="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
        :disabled="loading"
        @click="apply"
      >
        Apply
      </button>
      <button
        class="px-3 py-1 rounded bg-slate-600 hover:bg-slate-500 text-white disabled:opacity-50"
        :disabled="loading"
        @click="cancel"
      >
        Cancel
      </button>
    </div>

    <!-- Status -->
    <p v-if="lastError" class="text-xs text-red-400">{{ lastError }}</p>
    <p v-else-if="message" class="text-xs text-emerald-400">{{ message }}</p>
    <p v-else-if="loading" class="text-xs text-slate-300">Working…</p>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import {
  PRESETS as presets,
  selected as selectedPlatform,
  server,
  key,
  loading,
  lastError,
  message,
  readonlyServer,
  setPlatform,
  loadCurrentFromObs,
  applyToObs,
  cancelChanges,
} from "@/controllers/obs.rtmps.controller.js";

// ✅ import from rtmp.status.js (not obs.rtmps.controller.js)
import { setRtmpPlatform } from "@/controllers/rtmp.status.js";

// One and only one change handler
function onPlatformChange(e) {
  const val = e?.target?.value ?? selectedPlatform.value;
  setPlatform(val);        // updates your OBS RTMP form state
  setRtmpPlatform(val);    // updates the status card store
}

async function apply()  { await applyToObs(); }
async function cancel() { await cancelChanges(); }

// Single onMounted
onMounted(async () => {
  await loadCurrentFromObs();                 // pull current OBS settings
  setRtmpPlatform(selectedPlatform.value);    // initialize status store
});
</script>

