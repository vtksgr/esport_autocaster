// src/controllers/obs.scenegraph.controller.js
import { ref } from "vue";
import {
  connection,
  currentCollection,
  refreshCollections,
} from "./obs.scene.controller.js";

export const scenes = ref([]); // [{ sceneName, sources: [name, ...] }, ...]
export const selectedScene = ref(""); // string
export const sources = ref([]); // derived from scenes + selectedScene
export const loading = ref(false);
export const lastError = ref("");

// helpers
function deriveSources() {
  const entry = scenes.value.find((s) => s.sceneName === selectedScene.value);
  sources.value = entry ? entry.sources.slice() : [];
}

export async function loadScenesForCurrentCollection() {
  if (connection.value !== "connected") return;
  loading.value = true;
  lastError.value = "";
  try {
    // Pull everything for the *current* collection in one call
    const res = await window.api.invoke(
      "obs:getScenesAndSourcesForCurrentCollection"
    );
    const list = (res?.scenes || []).map((s) => ({
      sceneName: s.sceneName,
      sources: s.sources || [],
    }));
    scenes.value = list;

    // Keep selectedScene stable if possible
    if (
      !selectedScene.value ||
      !list.some((s) => s.sceneName === selectedScene.value)
    ) {
      selectedScene.value =
        res?.currentProgramSceneName || list[0]?.sceneName || "";
    }
    deriveSources();
  } catch (e) {
    lastError.value = e?.message || String(e);
    scenes.value = [];
    selectedScene.value = "";
    sources.value = [];
  } finally {
    loading.value = false;
  }
}

/** manual change from UI */
export function setSelectedScene(name) {
  selectedScene.value = name || "";
  deriveSources();
}

/** bootstraps watchers so the graph refreshes when:
 *  - OBS connects
 *  - the active scene collection changes
 */
export function attachSceneGraph() {
  // when we connect, (re)load
  const unConn = watch(
    connection,
    (s) => {
      if (s === "connected") loadScenesForCurrentCollection();
    },
    { immediate: true }
  );

  // when the collection changes, (re)load
  const unCol = watch(currentCollection, () => {
    loadScenesForCurrentCollection();
  });

  // when the selected scene changes, update sources
  const unSel = watch(selectedScene, deriveSources);

  return () => {
    unConn?.();
    unCol?.();
    unSel?.();
  };
}
