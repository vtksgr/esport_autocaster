//C:\comworks\esports-autocaster\electron\services\obs.service.js

import { getClient, isConnected } from "../connection/obs.connect.js";
import { assertConnected, sleep } from "./obs.shared.js";

/* -------------------------
   NEW: readiness + helpers
-------------------------- */
let obsReady = false;        // true when scene tree is stable
let wiringDone = false;

const READY_TIMEOUT = 7000;
const RETRY_DELAY   = 140;

function wireObsLifecycleOnce() {
  if (wiringDone) return;
  const obs = getClient();
  // When user/app starts, we don't know if ready yet
  obsReady = false;

  // Enter "not ready" window while OBS rebuilds after collection switch
  obs.on("CurrentSceneCollectionChanging", () => { obsReady = false; });

  // After collection switched, SceneListChanged will arrive when scenes are rebuilt
  obs.on("SceneListChanged", () => { obsReady = true; });

  // On initial connect you might not get SceneListChanged automatically,
  // so try to prime readiness by asking once (ignore 207).
  (async () => {
    try {
      await obs.call("GetSceneList");
      obsReady = true;
    } catch {
      // leave obsReady=false; it will flip when the first SceneListChanged arrives
    }
  })();

  wiringDone = true;
}
async function waitObsReady(timeout = READY_TIMEOUT) {
  const start = Date.now();
  while (!obsReady) {
    if (Date.now() - start > timeout) {
      throw new Error("OBS is not ready to perform the request.");
    }
    await sleep(RETRY_DELAY);
  }
}

async function callWithRetry(fn, tries = 4, delay = RETRY_DELAY) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      // If this is the 207 window, wait and try again
      const msg = e?.message || "";
      if (msg.includes("not ready") || msg.includes("OBS is not ready") || e?.code === 207) {
        lastErr = e;
        await sleep(delay);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}
/* -------------------------
   Ensure lifecycle wiring
-------------------------- */
function ensureWired() {
  assertConnected();
  wireObsLifecycleOnce();
}

/* -------------------------
   Scenes & collections (unchanged)
-------------------------- */
export async function getSceneCollections() {
  assertConnected();
  const obs = getClient();
  const { sceneCollections, currentSceneCollectionName } = await obs.call("GetSceneCollectionList");
  const names = (sceneCollections || []).map((s) =>
    typeof s === "string" ? s : s?.sceneCollectionName ?? s?.name ?? String(s)
  );
  return { sceneCollections: names, currentSceneCollectionName };
}

export async function getScenesAndSourcesForCurrentCollection() {
  assertConnected();
  const obs = getClient();
  const { scenes, currentProgramSceneName } = await obs.call("GetSceneList");
  const details = [];
  for (const { sceneName } of scenes) {
    const { sceneItems } = await obs.call("GetSceneItemList", { sceneName });
    details.push({ sceneName, sources: sceneItems.map((i) => i.sourceName) });
  }
  return { currentProgramSceneName, scenes: details };
}

export async function getScenesAndSourcesForCollection(sceneCollectionName, { peek = true, pauseMs = 250 } = {}) {
  assertConnected();
  if (!sceneCollectionName) throw new Error("sceneCollectionName is required");
  const obs = getClient();
  const { currentSceneCollectionName } = await obs.call("GetSceneCollectionList");
  const needSwitch = currentSceneCollectionName !== sceneCollectionName;

  try {
    if (needSwitch) {
      await obs.call("SetCurrentSceneCollection", { sceneCollectionName });
      await sleep(pauseMs);
    }
    const { scenes, currentProgramSceneName } = await obs.call("GetSceneList");
    const details = [];
    for (const { sceneName } of scenes) {
      const { sceneItems } = await obs.call("GetSceneItemList", { sceneName });
      details.push({ sceneName, sources: sceneItems.map((i) => i.sourceName) });
    }
    return { sceneCollectionName, currentProgramSceneName, scenes: details, switched: needSwitch && !peek, peeked: needSwitch && peek };
  } finally {
    if (peek && needSwitch && currentSceneCollectionName) {
      await obs.call("SetCurrentSceneCollection", { sceneCollectionName: currentSceneCollectionName });
    }
  }
}

export async function setSceneCollection(name) {
  assertConnected();
  return getClient().call("SetCurrentSceneCollection", { sceneCollectionName: name });
}

export async function getScenes() {
  assertConnected();
  return getClient().call("GetSceneList");
}

export async function switchScene(sceneName) {
  assertConnected();
  return getClient().call("SetCurrentProgramScene", { sceneName });
}
/*--------------------------
   Sources (unchanged)
-------------------------- */

export async function getSourcesForScene(sceneName) {
  assertConnected();
  if (!sceneName) throw new Error("sceneName is required");

  const obs = getClient();

  // OBS v5: GetSceneItemList -> { sceneItems: [{sourceName, ...}] }
  const { sceneItems = [] } = await obs.call("GetSceneItemList", { sceneName });

  // Optionally fetch each input's kind:
  // NOTE: Commented to avoid extra round trips. Uncomment if you need inputKind.
  // const withKinds = await Promise.all(sceneItems.map(async (it) => {
  //   try {
  //     const { inputKind } = await obs.call("GetInputKind", { inputName: it.sourceName });
  //     return { sourceName: it.sourceName, inputKind };
  //   } catch {
  //     return { sourceName: it.sourceName };
  //   }
  // }));

  return {
    sceneName,
    sources: sceneItems.map((it) => ({ sourceName: it.sourceName })),
    // sources: withKinds,
  };
}

/* -------------------------
   Re-exports for ergonomics
   (so ipc can keep importing from this file)
-------------------------- */
export * from "./obs.stream.service.js";
export * from "./obs.record.service.js";
export * from "./obs.virtualcam.service.js"; // optional; remove if not needed
export * from "./obs.rtmps.service.js";      // ✅ NEW


