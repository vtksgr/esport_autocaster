// electron/ipc/obs.ipc.js
// Owns all obs:* channels + pushes live connection state to renderer(s).

import { ipcMain } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  connect as obsConnect,
  disconnect as obsDisconnect,
  isConnected,
  getState,
  onState,
} from "../connection/obs.connect.js";

import {
  getSceneCollections,
  getScenesAndSourcesForCurrentCollection,
  getScenesAndSourcesForCollection,
  setSceneCollection,
  getScenes,
  switchScene,
  startStreaming,
  stopStreaming,
  getStatus,
  startRecording, 
  stopRecording, 
  getRecordStatus,
} from "../services/obs.service.js";

/* ---------------------------
   Config helpers (local only)
---------------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_PATH = join(__dirname, "..", "config.json");

async function loadConfig() {
  try {
    const txt = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(txt);
  } catch {
    return { url: "ws://127.0.0.1:4455", password: "" };
  }
}
async function saveConfig(cfg) {
  await writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
}

/* ------------------------------------
   Utility: safe handler with logging
------------------------------------- */
function withLog(name, fn) {
  return async (event, ...args) => {
    try {
      return await fn(event, ...args);
    } catch (err) {
      console.error(`[IPC] ${name} failed:`, err?.message || err);
      // Re-throw so renderer gets a rejected promise
      throw err;
    }
  };
}

/* ------------------------------------
   Public: register all obs:* channels
------------------------------------- */
/**
 * @param {import('electron').BrowserWindow} mainWindow
 * @returns {() => void} cleanup function to remove handlers and listeners
 */
export function registerObsIpc(mainWindow) {
  // Central list of channels we own.
  const CHANNELS = [
    "obs:connect",
    "obs:disconnect",
    "obs:isConnected",
    "obs:getState",

    "obs:getSceneCollections",
    "obs:getScenesAndSourcesForCurrentCollection",
    "obs:getScenesAndSourcesForCollection",
    "obs:setSceneCollection",

    "obs:get-scenes",
    "obs:switch-scene",
    "obs:startStreaming",
    "obs:stopStreaming",
    "obs:getStatus",
    "obs:startRecording",
    "obs:stopRecording",
    "obs:getRecordStatus",

    "obs:getConfig",
    "obs:saveConfig",
  ];

  // Hot-reload safety: clear prior handlers
  CHANNELS.forEach((ch) => ipcMain.removeHandler(ch));

  /* ---- Connection / state ---- */

  ipcMain.handle(
    "obs:connect",
    withLog("obs:connect", async (_evt, opts = {}) => {
      const cfg = await loadConfig();
      const url = opts.url || opts.host || cfg.url || "ws://127.0.0.1:4455";
      const supplied = typeof opts.password === "string" ? opts.password.trim() : "";
      const password = supplied || cfg.password || "";

      console.log(
        "[IPC] obs:connect",
        url,
        "pwd?",
        password ? "yes" : "no",
        `(source: ${supplied ? "renderer" : "config"})`
      );
      return obsConnect({ url, password });
    })
  );

  ipcMain.handle("obs:disconnect", withLog("obs:disconnect", () => obsDisconnect()));
  ipcMain.handle("obs:isConnected", () => isConnected());
  ipcMain.handle("obs:getState", () => getState());

  // Push connection-state updates to renderer(s)
  const unsubscribe = onState((state) => {
    // state: "connected" | "unstable" | "disconnected"
    if (!mainWindow?.webContents) return;
    mainWindow.webContents.send("obs:state", state);
  });

  /* ---- Collections / Scenes ---- */

  ipcMain.handle(
    "obs:getSceneCollections",
    withLog("obs:getSceneCollections", () => getSceneCollections())
  );

  ipcMain.handle(
    "obs:getScenesAndSourcesForCurrentCollection",
    withLog("obs:getScenesAndSourcesForCurrentCollection", () =>
      getScenesAndSourcesForCurrentCollection()
    )
  );

  ipcMain.handle(
    "obs:getScenesAndSourcesForCollection",
    withLog("obs:getScenesAndSourcesForCollection", (_e, arg = {}) => {
      // accept string or object with several possible keys
      const name =
        typeof arg === "string"
          ? arg
          : arg.name ||
            arg.sceneCollectionName ||
            arg.collection ||
            arg.sceneCollection;

      const peek = typeof arg.peek === "boolean" ? arg.peek : true;
      const pauseMs = Number.isFinite(arg.pauseMs) ? arg.pauseMs : 250;

      return getScenesAndSourcesForCollection(name, { peek, pauseMs });
    })
  );

  ipcMain.handle(
    "obs:setSceneCollection",
    withLog("obs:setSceneCollection", (_e, { name }) => setSceneCollection(name))
  );

  /* ---- Optional / legacy wrappers ---- */

  ipcMain.handle("obs:get-scenes", withLog("obs:get-scenes", () => getScenes()));

  ipcMain.handle(
    "obs:switch-scene",
    withLog("obs:switch-scene", (_e, sceneName) => switchScene(sceneName))
  );

  ipcMain.handle(
    "obs:startStreaming",
    withLog("obs:startStreaming", () => startStreaming())
  );

  ipcMain.handle(
    "obs:stopStreaming",
    withLog("obs:stopStreaming", () => stopStreaming())
  );

  ipcMain.handle("obs:getRecordStatus", withLog("obs:getRecordStatus", () => getRecordStatus()));

  ipcMain.handle("obs:startRecording", withLog("obs:startRecording", () => startRecording()));

  ipcMain.handle("obs:stopRecording", withLog("obs:stopRecording", () => stopRecording()));

  ipcMain.handle("obs:getStatus", withLog("obs:getStatus", () => getStatus()));

  

  /* ---- Config ---- */

  ipcMain.handle("obs:getConfig", withLog("obs:getConfig", () => loadConfig()));
  ipcMain.handle(
    "obs:saveConfig",
    withLog("obs:saveConfig", (_e, cfg) => saveConfig(cfg))
  );

  /* ---- Cleanup ---- */
  return () => {
    unsubscribe?.();
    CHANNELS.forEach((ch) => ipcMain.removeHandler(ch));
  };
}
