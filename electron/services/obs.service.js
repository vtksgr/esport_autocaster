// electron/services/obs.service.js
import { getClient, isConnected } from "../connection/obs.connect.js";

function assertConnected() {
  if (!isConnected()) throw new Error("Not connected to OBS");
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

export async function getScenesAndSourcesForCollection(
  sceneCollectionName,
  { peek = true, pauseMs = 250 } = {}
) {
  assertConnected();
  if (!sceneCollectionName) throw new Error("sceneCollectionName is required");
  const obs = getClient();
  const { currentSceneCollectionName } = await obs.call("GetSceneCollectionList");
  const needSwitch = currentSceneCollectionName !== sceneCollectionName;

  try {
    if (needSwitch) {
      await obs.call("SetCurrentSceneCollection", { sceneCollectionName });
      await sleep(pauseMs); // optional: replace with a poll if you see flakiness
    }
    const { scenes, currentProgramSceneName } = await obs.call("GetSceneList");
    const details = [];
    for (const { sceneName } of scenes) {
      const { sceneItems } = await obs.call("GetSceneItemList", { sceneName });
      details.push({ sceneName, sources: sceneItems.map((i) => i.sourceName) });
    }
    return {
      sceneCollectionName,
      currentProgramSceneName,
      scenes: details,
      switched: needSwitch && !peek,
      peeked: needSwitch && peek,
    };
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

/* -------------------------
   Streaming controls
-------------------------- */
export async function startStreaming() {
  assertConnected();
  return getClient().call("StartStream");
}

// Idempotent + wait-until-stopped
export async function stopStreaming() {
  assertConnected();
  const obs = getClient();

  try {
    const s = await obs.call("GetStreamStatus");
    if (!s?.outputActive) return { ok: true, alreadyStopped: true };
  } catch { /* ignore */ }

  try {
    await obs.call("StopStream");
  } catch (e) {
    const msg = e?.message || String(e);
    if (/not\s+active|already|stopp?ing/i.test(msg)) return { ok: true, noop: true };
    throw e;
  }

  for (let i = 0; i < 25; i++) {
    try {
      const s = await obs.call("GetStreamStatus");
      if (!s?.outputActive) break;
    } catch { /* ignore */ }
    await sleep(120);
  }
  return { ok: true };
}

export async function getStatus() {
  assertConnected();
  return getClient().call("GetStreamStatus");
}

/* -------------------------
   Recording controls
-------------------------- */
export async function startRecording() {
  assertConnected();
  return getClient().call("StartRecord");
}

// Idempotent + wait-until-stopped
export async function stopRecording() {
  assertConnected();
  const obs = getClient();

  try {
    const r = await obs.call("GetRecordStatus");
    if (!r?.outputActive) return { ok: true, alreadyStopped: true };
  } catch { /* ignore */ }

  try {
    await obs.call("StopRecord");
  } catch (e) {
    const msg = e?.message || String(e);
    if (/not\s+active|already|stopp?ing/i.test(msg)) return { ok: true, noop: true };
    throw e;
  }

  for (let i = 0; i < 25; i++) {
    try {
      const r = await obs.call("GetRecordStatus");
      if (!r?.outputActive) break;
    } catch { /* ignore */ }
    await sleep(120);
  }
  return { ok: true };
}

export async function getRecordStatus() {
  assertConnected();
  return getClient().call("GetRecordStatus");
}
