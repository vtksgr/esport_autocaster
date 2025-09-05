//C:\comworks\esports-autocaster\src\controllers\obs.scene.controller.js
import {ref, watch} from "vue";
import { ensureVirtualCamActiveOnce } from "./obs.virtualcam.controller.js";

export const connection        = ref("disconnected"); // "connected" | "unstable" | "disconnected"
export const collections       = ref([]);             // list of names
export const currentCollection = ref("");             // active name
export const loading           = ref(false);
export const lastError         = ref("");   

function uniqueSorted(list) {
  return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
}

export async function refreshCollections() {
  lastError.value = "";
  try {
    const res = await window.api.invoke("obs:getSceneCollections");
    collections.value = uniqueSorted(res?.sceneCollections ?? []);
    currentCollection.value = res?.currentSceneCollectionName ?? "";
    //Auto-start Virtual Cam only once, and only after collections are ready
    await ensureVirtualCamActiveOnce({
      requireCollectionsReady: {
        collections: collections.value,
        currentCollection: currentCollection.value,
      },
    });
  } catch (e) {
    lastError.value = e?.message || String(e);
    collections.value = [];
    currentCollection.value = "";
  }
}

export async function setCollection(name) {
  if (!name) return;
  loading.value = true;
  lastError.value = "";
  try {
    await window.api.invoke("obs:setSceneCollection", { name });
    await refreshCollections();
  } catch (e) {
    lastError.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}

export function attach() {
  if (!window.api || typeof window.api.onObsState !== "function") {
    return () => {};
  }
  const off = window.api.onObsState(async (s) => {
    connection.value = s || "disconnected";
    if (s === "connected") await refreshCollections();
  });
  return off;
}

export async function bootstrap() {
  try {
    const s = await window.api.invoke("obs:getState");
    connection.value = s || "disconnected";
  } catch {
    connection.value = "disconnected";
  }
  if (connection.value === "connected") await refreshCollections();
}

// optional: debug
watch(currentCollection, (v) => console.log("[UI] currentCollection ->", v));