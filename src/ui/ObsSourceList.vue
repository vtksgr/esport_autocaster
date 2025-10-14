<!-- C:\comworks\esports-autocaster\src\ui\ObsSourceList.vue -->
<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from "vue";

const props = defineProps({ sceneName: { type: String, default: "" } });

const connection = ref("disconnected");
const lastConn   = ref("disconnected");
const loading    = ref(false);
const error      = ref("");
const sources    = ref([]);
let unsub = null;
let inflight = false;

function subscribeObsState(handler) {
  // Preferred: our preload exposes .on and returns an unsubscribe function
  if (window?.api && typeof window.api.on === "function") {
    // Wrap to match (null, state) signature expected by handler
    const stop = window.api.on("obs:state", (state) => handler(null, state));
    return () => { try { stop?.(); } catch {} };
  }
  // Alternate preload style (receive/removeListener)
  if (window?.api && typeof window.api.receive === "function") {
    const wrapped = (_evt, state) => handler(null, state);
    window.api.receive("obs:state", wrapped);
    return () => window.api?.removeListener?.("obs:state", wrapped);
  }
  // Fallback: change-aware 5s polling
  let last = null, t = null;
  const poll = async () => {
    try {
      const s = await window.api.invoke("obs:getState");
      if (s !== last) { last = s; handler(null, s || "disconnected"); }
    } catch {
      if (last !== "disconnected") { last = "disconnected"; handler(null, "disconnected"); }
    }
  };
  poll();
  t = setInterval(poll, 5000);
  return () => clearInterval(t);
}


async function loadSources(name) {
  if (!name || inflight) { if (!name) sources.value = []; return; }
  inflight = true;
  loading.value = true;
  error.value = "";

async function viaDedicated() {
  const res = await window.api.invoke("obs:getSourcesForScene", { sceneName: name });
  // Normalize a few possible shapes into [{ sourceName, inputKind? }, ...]
  const arr =
    Array.isArray(res?.sources) ? res.sources :
    Array.isArray(res?.sceneItems) ? res.sceneItems :
    Array.isArray(res) ? res :
    [];

  return arr.map((it) => {
    if (typeof it === "string") return { sourceName: it };
    return {
      sourceName: it.sourceName || it.name || it.source || "",
      inputKind: it.inputKind || it.type || it.kind || undefined,
      sceneItemId: it.sceneItemId ?? it.id ?? undefined,
    };
  });
}

  async function viaSnapshot() {
    const res = await window.api.invoke("obs:getScenesAndSourcesForCurrentCollection");
    const match = (res?.scenes || []).find(s => s.sceneName === name);
        return match
      ? (match.sources || []).map((sn) => ({
          sourceName: typeof sn === "string" ? sn : sn?.sourceName || "",
          inputKind: typeof sn === "object" && sn !== null ? sn.inputKind ?? undefined : undefined,
          sceneItemId: typeof sn === "object" && sn !== null ? sn.sceneItemId ?? undefined : undefined,
        }))
      : [];
  }

  try {
    let list = [];
    try {
      list = await viaDedicated();
    } catch (e) {
      const msg = e?.message || "";
      const noHandler = msg.includes("No handler registered") || msg.includes("handler has not been registered");
      if (noHandler) list = await viaSnapshot();
      else throw e;
    }
    sources.value = list;
  } catch (e) {
    error.value = e?.message || String(e);
    sources.value = [];
  } finally {
    loading.value = false;
    inflight = false;
  }
}

function onObsState(_evt, state) {
  if (state === lastConn.value) return; // change-aware
  lastConn.value = state;
  connection.value = state;
  if (state === "connected" && props.sceneName) loadSources(props.sceneName);
}

onMounted(async () => {
  unsub = subscribeObsState(onObsState);
  // seed current state
  try {
    const s = await window.api.invoke("obs:getState");
    connection.value = s || "disconnected";
    if (connection.value === "connected" && props.sceneName) loadSources(props.sceneName);
  } catch {
    connection.value = "disconnected";
  }
});

onBeforeUnmount(() => { try { unsub?.(); } catch { } });

watch(() => props.sceneName, (next, prev) => {
  if (next && connection.value === "connected") {
    loadSources(next);
  } else if (!next) {
    sources.value = [];
  }
}, { immediate: true });
</script>


<template>
  <!-- Card becomes a flex column and has a fixed height -->
  <div class="bg-slate-700 w-80 h-96 rounded p-2 border border-slate-600 flex flex-col">
    <div class="flex items-center justify-between p-2 border-b border-slate-600 shrink-0">
      <p class="font-semibold text-slate-300">Sources</p>
    </div>

    <!-- Content area: take remaining space and enable vertical scroll -->
    <div class="pt-4 px-2 grow overflow-hidden">
      <div v-if="loading" class="text-sm text-gray-400">Loading sources…</div>
      <div v-else-if="error" class="text-sm text-red-300">{{ error }}</div>
      <div v-else-if="!props.sceneName" class="text-[11px] text-slate-500">Select a scene to view sources.</div>
      <div v-else-if="!sources.length" class="text-[11px] text-slate-500">No sources.</div>

      <!-- Scroll container only when we actually render the list -->
      <div v-else class="h-full overflow-y-auto custom-scroll">
        <ul class="space-y-2">
          <li
            v-for="src in sources"
            :key="src.sourceName"
            class="flex items-center justify-between text-[11px] px-3 text-slate-400"
          >
            <!-- To make truncate work in flex, give max-w-0 on inner wrapper -->
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{{ src.sourceName }}</div>
              <div v-if="src.inputKind" class="text-xs text-gray-500 truncate">
                {{ src.inputKind }}
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
<style scoped>
.custom-scroll::-webkit-scrollbar {
  width: 8px;
}
.custom-scroll::-webkit-scrollbar-track {
  background: #1e222b;
}
.custom-scroll::-webkit-scrollbar-thumb {
  background-color: #2e3340;
  border-radius: 8px;
  border: 2px solid #1e222b;
}
</style>


