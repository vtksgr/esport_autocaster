<!-- C:\comworks\esports-autocaster\src\ui\ObsSceneList.vue -->
<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import { currentCollection } from "../controllers/obs.scene.controller.js";

const emit = defineEmits(["scene:select"]);

const connection     = ref("disconnected");
const loading        = ref(false);
const error          = ref("");
const scenes         = ref([]);
const currentScene   = ref("");
const selectedScene  = ref("");


let offState = null;
// let offReady = null;
// let offScenes = null;

function onPick(name) {
  selectedScene.value = name;
  emit("scene:select", name);
}
async function loadScenes() {
  // If no active collection, clear
  if (!currentCollection.value) {
    scenes.value = [];
    currentScene.value = "";
    selectedScene.value = "";
    emit("scene:select", "");
    return;
  }
    loading.value = true;
  error.value = "";
  try {
    const data = await window.api.invoke("obs:getScenesAndSourcesForCurrentCollection");
    // Keep the same shape your template expects: { sceneName }
    const names = (data?.scenes || []).map(s => ({ sceneName: s.sceneName })).filter(s => !!s.sceneName);
    scenes.value = names;

    // Maintain a valid selection
    const hasSelected = names.some(s => s.sceneName === selectedScene.value);
    if (!hasSelected) {
      currentScene.value = names[0]?.sceneName || "";
      selectedScene.value = currentScene.value;
      emit("scene:select", selectedScene.value || "");
    }
  } catch (e) {
    error.value = e?.message || String(e);
    scenes.value = [];
    currentScene.value = "";
    selectedScene.value = "";
    emit("scene:select", "");
  } finally {
    loading.value = false;
  }
}

// Subscribe to connection state if your preload exposes it
// Subscribe to connection state if your preload exposes it
onMounted(() => {
  if (window?.api?.onObsState) {
    offState = window.api.onObsState((s) => {
      connection.value = s || "disconnected";
    });
  }
});

// Re-fetch scenes whenever the active collection changes (fixes "load once")
watch(currentCollection, loadScenes, { immediate: true });

// Cleanup (only once; remove the other onBeforeUnmount you had)
onBeforeUnmount(() => {
  try { offState?.(); } catch {}
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
    <div class="pt-4 px-2">
      <div v-if="loading" class="text-sm text-gray-300">Loading scenes…</div>
      <div v-else-if="error" class="text-sm text-red-300">{{ error }}</div>
      <div v-else-if="!scenes.length" class="text-sm text-gray-300">No scenes.</div>

      <!-- Row layout: plain text chips; only selected has bg -->
      <ul v-else class="text-sm space-y-1">
        <li v-for="s in scenes" :key="s.sceneName" class="shrink-0">
          <button
            type="button"
            @click="onPick(s.sceneName)"
            :aria-pressed="s.sceneName === selectedScene"
            class="px-2 w-full py-1 rounded text-[11px] text-left
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
                   transition-none"
            :class="s.sceneName === selectedScene
              ? 'bg-blue-600 text-white w-full'
              : 'bg-transparent text-slate-100'"
          >
            <span class=" ">
              <span class="truncate max-w-[16ch] sm:max-w-[24ch]">{{ s.sceneName }}</span>

            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

