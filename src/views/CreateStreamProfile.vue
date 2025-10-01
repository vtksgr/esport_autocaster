<template>
  <div class="space-y-3">
    <div class="flex items-end gap-2">
      <div>
        <label class="text-xs text-slate-400">Window Title</label>
        <input v-model="windowTitle" class="border rounded px-2 py-1 text-sm bg-slate-900/40 border-slate-600 w-80">
      </div>
      <div>
        <label class="text-xs text-slate-400">Camera Name</label>
        <input v-model="cameraName" class="border rounded px-2 py-1 text-sm bg-slate-900/40 border-slate-600 w-64">
      </div>
      <button @click="apply"
              class="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-sm">
        Apply SK1
      </button>
    </div>

    <div class="flex gap-2">
      <button @click="setWindow" class="px-2 py-1 rounded bg-slate-700 text-xs">Update Window</button>
      <button @click="setCamera" class="px-2 py-1 rounded bg-slate-700 text-xs">Update Camera</button>
    </div>

    <p class="text-xs text-slate-400">
      Assets auto-load from:
      <code>src/assets/logo</code>,
      <code>src/assets/background</code>,
      <code>src/assets/frame</code>,
      <code>src/assets/overley</code>.
    </p>
  </div>
</template>

<script setup>
import { ref } from "vue";
const windowTitle = ref("");  // e.g., "chrome.exe: Battlefield 3"
const cameraName  = ref("");  // e.g., "Logitech C920"

async function apply() {
  await window.api.invoke("obs:profile:apply", {
    name: "SK1",
    options: { windowTitle: windowTitle.value, cameraName: cameraName.value }
  });
}

async function setWindow() {
  await window.api.invoke("obs:profile:updateWindow", { windowTitle: windowTitle.value });
}
async function setCamera() {
  await window.api.invoke("obs:profile:updateCamera", { cameraName: cameraName.value });
}
</script>
