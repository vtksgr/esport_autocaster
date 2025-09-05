// electron/services/obs.opslog.service.js
// Build a human-readable "user ops" log from obs-websocket events.

import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

// Keep a rolling buffer in memory
const MAX_BUFFER = 2000;
const buffer = [];

// Optional: persist to file (rotates per day)
// Lazily compute the log dir so we don’t touch app.getPath() before app is ready.
function getLogDir() {
  try {
    return path.join(app.getPath("userData"), "logs");
  } catch {
    // Fallback only if called too early (shouldn’t happen in normal flow)
    return path.join(process.cwd(), "logs");
  }
}
function logFilePath() {
  const d = new Date();
  const iso = d.toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(getLogDir(), `obs-ops-${iso}.log`);
}
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function persist(line) {
  try {
    const dir = getLogDir();
    ensureDir(dir);
    fs.appendFileSync(logFilePath(), line + "\n", { encoding: "utf8" });
  } catch (e) {
    // non-fatal
  }
}


function nowISO() {
  return new Date().toISOString();
}

function pushAndPersist(entry, mainWindow) {
  const line = JSON.stringify(entry);
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();
  persist(line);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("obs:opslog:append", entry);
  }
}

export function getOpsLogSnapshot() {
  return buffer.slice(-MAX_BUFFER);
}

/**
 * Wire up listeners on an OBSWebSocket instance.
 * Call this once after the socket connects (and again after reconnects).
 */
export function attachOpsLog(obs, mainWindow) {
  // Clear nothing on attach; we want continuity across reconnects.

  const on = (event, handler) => obs.on(event, (payload) => {
    try { handler(payload); } catch {}
  });

  // --- Stream / Record / VirtualCam
  on("StreamStateChanged", ({ outputActive, outputState }) =>
    pushAndPersist({ t: nowISO(), type: "stream", msg: outputActive ? "Stream started" : "Stream stopped", data: { outputState } }, mainWindow)
  );

  on("RecordStateChanged", ({ outputActive, outputState }) =>
    pushAndPersist({ t: nowISO(), type: "record", msg: outputActive ? "Recording started" : "Recording stopped", data: { outputState } }, mainWindow)
  );

  on("VirtualcamStateChanged", ({ outputActive }) =>
    pushAndPersist({ t: nowISO(), type: "virtualcam", msg: outputActive ? "Virtual Camera started" : "Virtual Camera stopped" }, mainWindow)
  );

  // --- Scene switching / collections
  on("CurrentProgramSceneChanged", ({ sceneName }) =>
    pushAndPersist({ t: nowISO(), type: "scene", msg: `Switched Program scene → ${sceneName}`, data: { sceneName } }, mainWindow)
  );

  on("CurrentPreviewSceneChanged", ({ sceneName }) =>
    pushAndPersist({ t: nowISO(), type: "scene", msg: `Switched Preview scene → ${sceneName}`, data: { sceneName } }, mainWindow)
  );

  on("SceneCreated", ({ sceneName }) =>
    pushAndPersist({ t: nowISO(), type: "scene", msg: `Scene created: ${sceneName}` }, mainWindow)
  );

  on("SceneRemoved", ({ sceneName }) =>
    pushAndPersist({ t: nowISO(), type: "scene", msg: `Scene removed: ${sceneName}` }, mainWindow)
  );

  on("CurrentSceneCollectionChanged", ({ sceneCollectionName }) =>
    pushAndPersist({ t: nowISO(), type: "collection", msg: `Scene Collection changed → ${sceneCollectionName}` }, mainWindow)
  );

  // --- Inputs / Sources
  on("InputMuteStateChanged", ({ inputName, inputMuted }) =>
    pushAndPersist({ t: nowISO(), type: "audio", msg: `${inputMuted ? "Muted" : "Unmuted"}: ${inputName}` }, mainWindow)
  );

  on("InputVolumeChanged", ({ inputName, inputVolumeMul }) =>
    pushAndPersist({ t: nowISO(), type: "audio", msg: `Volume changed: ${inputName} → ${inputVolumeMul.toFixed(3)}` }, mainWindow)
  );

  on("InputActiveStateChanged", ({ inputName, videoActive }) =>
    pushAndPersist({ t: nowISO(), type: "source", msg: `Source ${videoActive ? "active" : "inactive"}: ${inputName}` }, mainWindow)
  );

  on("SourceFilterEnableStateChanged", ({ sourceName, filterName, filterEnabled }) =>
    pushAndPersist({ t: nowISO(), type: "filter", msg: `${filterEnabled ? "Enabled" : "Disabled"} filter '${filterName}' on ${sourceName}` }, mainWindow)
  );

  // --- Studio Mode
  on("StudioModeStateChanged", ({ studioModeEnabled }) =>
    pushAndPersist({ t: nowISO(), type: "studio", msg: `Studio Mode ${studioModeEnabled ? "enabled" : "disabled"}` }, mainWindow)
  );

  // --- Transitions
  on("CurrentSceneTransitionChanged", ({ transitionName }) =>
    pushAndPersist({ t: nowISO(), type: "transition", msg: `Transition changed → ${transitionName}` }, mainWindow)
  );

  on("SceneTransitionEnded", ({ transitionName, fromSceneName, toSceneName }) =>
    pushAndPersist({ t: nowISO(), type: "transition", msg: `Transition '${transitionName}' ended: ${fromSceneName} → ${toSceneName}` }, mainWindow)
  );
}
