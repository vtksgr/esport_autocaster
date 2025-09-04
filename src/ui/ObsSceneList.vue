<!-- C:\comworks\esports-autocaster\src\ui\ObsSceneList.vue -->
<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";

const connection     = ref("disconnected");
const loading        = ref(false);
const error          = ref("");
const scenes         = ref([]);
const currentScene   = ref("");
const selectedScene  = ref("");

const emit = defineEmits(["scene:select"]);

let offState = null;
let offReady = null;
let offScenes = null;

function onPick(name) {
  selectedScene.value = name;
  emit("scene:select", name);
}

onMounted(async () => {
  // 1) Subscribe to OBS connection state
  if (window?.api?.onObsState) {
    offState = window.api.onObsState((s) => {
      connection.value = s || "disconnected";
    });
  }

  // 2) Subscribe to readiness: when false, show loading; when true, we’ll get a scene-list event
  if (window?.api?.onObsReady) {
    offReady = window.api.onObsReady((isReady) => {
      if (!isReady) {
        loading.value = true;
        error.value = "";
      }
      // when it flips to true, a 'obs:scene-list' event will arrive shortly
    });
  }

  // 3) Subscribe to pushed scene list: update UI here
  if (window?.api?.onObsSceneList) {
    offScenes = window.api.onObsSceneList((list) => {
      try {
        const onlyNames = (list || []).map(s => ({ sceneName: s.sceneName || s.name || String(s) }));
        scenes.value = onlyNames;
        // pick a current
        currentScene.value = onlyNames?.[0]?.sceneName || currentScene.value || "";
        if (!selectedScene.value) selectedScene.value = currentScene.value;
        if (selectedScene.value) emit("scene:select", selectedScene.value);
        loading.value = false;
        error.value = "";
      } catch (e) {
        error.value = e?.message || String(e);
        scenes.value = [];
        loading.value = false;
      }
    });
  }

  // Seed connection state & kick an initial fetch via IPC if needed:
  try {
    const s = await window.api?.invoke?.("obs:getState");
    connection.value = s || "disconnected";
    if (connection.value === "connected") {
      // Ask main for current scenes once (main should waitReady + push scene-list too)
      try {
        await window.api.invoke("obs:primeScenes"); // see IPC note below
      } catch {}
    }
  } catch {}
});

onBeforeUnmount(() => {
  try { offState?.(); } catch {}
  try { offReady?.(); } catch {}
  try { offScenes?.(); } catch {}
});
</script>


<template>
  <div class="bg-slate-700 w-80 h-96 rounded p-2 border border-slate-600">
    <!-- Header -->
    <div class="flex items-center justify-between p-2 border-b border-slate-600">
      <p class="font-semibold text-white">Scenes</p>
    </div>

    <!-- Body -->
    <div class="p-4">
      <div v-if="loading" class="text-sm text-gray-300">Loading scenes…</div>
      <div v-else-if="error" class="text-sm text-red-300">{{ error }}</div>
      <div v-else-if="!scenes.length" class="text-sm text-gray-300">No scenes.</div>

      <!-- Row layout: plain text chips; only selected has bg -->
      <ul v-else class="flex flex-wrap gap-x-3 gap-y-2">
        <li v-for="s in scenes" :key="s.sceneName" class="shrink-0">
          <button
            type="button"
            @click="onPick(s.sceneName)"
            :aria-pressed="s.sceneName === selectedScene"
            class="px-2 w-full py-1 rounded-md text-[11px]
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
                   transition-none"
            :class="s.sceneName === selectedScene
              ? 'bg-blue-600 text-white w-full'
              : 'bg-transparent text-slate-100'"
          >
            <span class="inline-flex items-center gap-1">
              <span class="truncate max-w-[16ch] sm:max-w-[24ch]">{{ s.sceneName }}</span>

            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

