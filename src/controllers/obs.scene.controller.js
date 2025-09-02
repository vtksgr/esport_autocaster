// src\obs\obs.scene.controller.js
import {ref, watch} from "vue";

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
    collections.value       = uniqueSorted(res?.sceneCollections ?? []);
    currentCollection.value = res?.currentSceneCollectionName ?? "";
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
  if (!window.api) return () => {};
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