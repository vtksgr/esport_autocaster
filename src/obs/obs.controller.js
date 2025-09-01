import { ref, watch } from "vue";

const connection        = ref("disconnected"); // "connected" | "unstable" | "disconnected"
const collections       = ref([]);             // list of names
const currentCollection = ref("");             // active name
const isStreaming       = ref(false);
const isRecording       = ref(false);
const loading           = ref(false);
const lastError         = ref("");

function uniqueSorted(list) {
  return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
}

async function refreshCollections() {
  lastError.value = "";
  try {
    const res = await window.api.invoke("obs:getSceneCollections");
    // res: { sceneCollections: string[], currentSceneCollectionName: string }
    console.log("[UI] getSceneCollections =>", res);
    collections.value       = uniqueSorted(res?.sceneCollections ?? []);
    currentCollection.value = res?.currentSceneCollectionName ?? "";
  } catch (e) {
    console.warn("[UI] getSceneCollections failed:", e);
    lastError.value = e?.message || String(e);
    collections.value = [];
    currentCollection.value = "";
  }
}

async function refreshStatuses() {
  lastError.value = "";
  try {
    const s = await window.api.invoke("obs:getStatus");       // stream
    isStreaming.value = !!s?.outputActive;
  } catch (e) {
    isStreaming.value = false;
  }
  try {
    const r = await window.api.invoke("obs:getRecordStatus"); // record
    isRecording.value = !!r?.outputActive;
  } catch (e) {
    isRecording.value = false;
  }
}

async function setCollection(name) {
  if (!name) return;
  loading.value = true;
  lastError.value = "";
  try {
    await window.api.invoke("obs:setSceneCollection", { name });
    await refreshCollections();  // re-read to confirm
    await refreshStatuses();
  } catch (e) {
    lastError.value = e?.message || String(e);
    console.error("[UI] setCollection failed:", e);
  } finally {
    loading.value = false;
  }
}

// Stream controls
async function startStream() { await window.api.invoke("obs:startStreaming"); await refreshStatuses(); }
// Transport: only run on button click
async function stopStream()  {
  loading.value = true;
  lastError.value = "";
  try {
    await window.api.invoke("obs:stopStreaming");
  } catch (e) {
    const msg = e?.message || String(e);
    if (!/not\s+active|already|stopp?ing/i.test(msg)) {
      lastError.value = msg;
    }
    // else: treat as success
  } finally {
    // Small grace for OBS to flip states
    await new Promise(r => setTimeout(r, 200));
    await refreshStatuses();
    loading.value = false;
  }
}
// Recording controls
async function startRecord() { await window.api.invoke("obs:startRecording"); await refreshStatuses(); }
async function stopRecord()  {
  loading.value = true;
  lastError.value = "";
  try {
    await window.api.invoke("obs:stopRecording");
  } catch (e) {
    const msg = e?.message || String(e);
    if (!/not\s+active|already|stopp?ing/i.test(msg)) {
      lastError.value = msg;
    }
  } finally {
    await new Promise(r => setTimeout(r, 200));
    await refreshStatuses();
    loading.value = false;
  }
}

function attach() {
  if (!window.api) return () => {};
  const off = window.api.onObsState(async (s) => {
    console.log("[UI] obs:state =>", s);
    connection.value = s;
    if (s === "connected") {
      await refreshCollections();
      await refreshStatuses();
    }
  });
  return off;
}

async function bootstrap() {
  try {
    const s = await window.api.invoke("obs:getState");
    connection.value = s || "disconnected";
  } catch {
    connection.value = "disconnected";
  }
  if (connection.value === "connected") {
    await refreshCollections();
    await refreshStatuses();
  }
}

// optional: keep selected synced when OBS switches externally
watch(currentCollection, (v) => {
  console.log("[UI] currentCollection ->", v);
});

const obsController = {
  // state
  connection, collections, currentCollection,
  isStreaming, isRecording, loading, lastError,
  // lifecycle
  attach, bootstrap,
  // actions
  setCollection, startStream, stopStream, startRecord, stopRecord,
  // utils
  refreshCollections, refreshStatuses,
};

export default obsController;
export { obsController };
