// electron/ipc/obs.ipc.js
// Owns all obs:* channels + pushes live connection state to renderer(s).

import { ipcMain, app } from "electron";
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
  startVirtualCam,
  stopVirtualCam,
  getVirtualCamStatus,
  getSourcesForScene,
} from "../services/obs.service.js";

import {
  getStreamServiceSettings,
  setStreamServiceSettings,
  validatePlatformAndUrl,
} from "../services/obs.rtmps.service.js";

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
      const detail =
        err && (err.stack || `${err.code ?? ""} ${err.message ?? err}`);
      console.error(`[IPC] ${name} failed:`, detail);
      // Send back a richer error
      const e = new Error(`[${name}] ${err?.message || String(err)}`);
      e.code = err?.code;
      throw e;
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

    "obs:getSourcesForScene",

    "obs:startStreaming",
    "obs:stopStreaming",
    "obs:getStatus",
    "obs:startRecording",
    "obs:stopRecording",
    "obs:getRecordStatus",

    "obs:getConfig",
    "obs:saveConfig",

    "obs:startVirtualCam",
    "obs:stopVirtualCam",
    "obs:getVirtualCamStatus",

    "obs:getStreamServiceSettings",
  "obs:setStreamServiceSettings",
  "obs:validateRtmpUrl",
  ];

  // Hot-reload safety: clear prior handlers
  CHANNELS.forEach((ch) => ipcMain.removeHandler(ch));
  //console.log("[IPC] registered channels:", CHANNELS);

  /* ---- Connection / state ---- */
  

  ipcMain.handle(
    "obs:connect",
    withLog("obs:connect", async (_evt, opts = {}) => {
      const cfg = await loadConfig();
      const url = opts.url || opts.host || cfg.url || "ws://127.0.0.1:4455";
      const supplied =
        typeof opts.password === "string" ? opts.password.trim() : "";
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

  ipcMain.handle(
    "obs:disconnect",
    withLog("obs:disconnect", () => obsDisconnect())
  );
  ipcMain.handle("obs:isConnected", () => isConnected());
  ipcMain.handle("obs:getState", () => getState());

  // Push connection-state updates to renderer(s)
  const unsubscribe = onState((state) => {
    // state: "connected" | "unstable" | "disconnected"
    if (!mainWindow?.webContents) return;
    mainWindow.webContents.send("obs:state", state);
  });

  /* GET SCENES COLLECTION & SCENES */

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
    withLog("obs:setSceneCollection", (_e, { name }) =>
      setSceneCollection(name)
    )
  );

  /* GET SOURCES FOR SCENE */
  ipcMain.handle(
    "obs:getSourcesForScene",
    withLog("obs:getSourcesForScene", (_e, { sceneName }) => {
      if (!sceneName) throw new Error("sceneName is required");
      return getSourcesForScene(sceneName);
    })
  );

  /* USING OBS VIRTUAL CAM */
  ipcMain.handle(
    "obs:startVirtualCam",
    withLog("obs:startVirtualCam", async () => {
      const res = await startVirtualCam(); // await start
      try {
        mainWindow?.webContents?.send("obs:virtualcam:changed", {
          outputActive: true,
        });
      } catch {}
      return res;
    })
  );

  ipcMain.handle(
    "obs:stopVirtualCam",
    withLog("obs:stopVirtualCam", async () => {
      const res = await stopVirtualCam(); // call once
      try {
        mainWindow?.webContents?.send("obs:virtualcam:changed", {
          outputActive: false,
        });
      } catch {}
      return res;
    })
  );

  ipcMain.handle(
    "obs:getVirtualCamStatus",
    withLog("obs:getVirtualCamStatus", () => {
      if (!isConnected()) return { outputActive: false, disconnected: true };
      return getVirtualCamStatus();
    })
  );

  /* ---- Optional / legacy wrappers ---- */

  ipcMain.handle(
    "obs:get-scenes",
    withLog("obs:get-scenes", () => getScenes())
  );

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

  ipcMain.handle(
    "obs:getRecordStatus",
    withLog("obs:getRecordStatus", () => getRecordStatus())
  );

  ipcMain.handle(
    "obs:startRecording",
    withLog("obs:startRecording", () => startRecording())
  );

  ipcMain.handle(
    "obs:stopRecording",
    withLog("obs:stopRecording", () => stopRecording())
  );

  ipcMain.handle(
    "obs:getStatus",
    withLog("obs:getStatus", () => {
      //avoid choise error durring app start
      if (!isConnected()) return { outputActive: false, disconnected: true };
      return getStatus();
    })
  );

  /* ---- Config ---- */

  ipcMain.handle(
    "obs:getConfig",
    withLog("obs:getConfig", () => loadConfig())
  );
  ipcMain.handle(
    "obs:saveConfig",
    withLog("obs:saveConfig", (_e, cfg) => saveConfig(cfg))
  );


  /* ---- RTMP(S) Settings ---- */
  ipcMain.handle(
  "obs:getStreamServiceSettings",
  withLog("obs:getStreamServiceSettings", () => getStreamServiceSettings())
);

ipcMain.handle(
  "obs:validateRtmpUrl",
  withLog("obs:validateRtmpUrl", (_e, { platform, server }) => {
    validatePlatformAndUrl(platform, server);
    return { ok: true };
  })
);

ipcMain.handle(
  "obs:setStreamServiceSettings",
  withLog("obs:setStreamServiceSettings", (_e, payload) => setStreamServiceSettings(payload))
);


  // --- Stop Virtual Cam on app/window shutdown (and support hot-reload) ---
  async function shutdownVirtualCam() {
    try {
      if (!isConnected()) return;
      const s = await getVirtualCamStatus(); // { outputActive: boolean }
      if (s?.outputActive) {
        await stopVirtualCam();
        try {
          mainWindow?.webContents?.send("obs:virtualcam:changed", {
            outputActive: false,
          });
        } catch {}
      }
    } catch (err) {
      console.warn(
        "[OBS] Failed to stop Virtual Cam during shutdown:",
        err?.message || err
      );
    }
  }

  // Keep stable refs so we can remove listeners in cleanup
  let didAttachShutdownHooks = false;
  let onWindowClose = null;
  let onBeforeQuit = null;

  function attachShutdownHooks() {
    if (didAttachShutdownHooks) return;
    onWindowClose = async () => {
      await shutdownVirtualCam();
    };
    onBeforeQuit = async () => {
      await shutdownVirtualCam();
    };
    if (mainWindow) mainWindow.on("close", onWindowClose);
    app.on("before-quit", onBeforeQuit);
    didAttachShutdownHooks = true;
  }

  function detachShutdownHooks() {
    if (!didAttachShutdownHooks) return;
    if (onWindowClose && mainWindow)
      mainWindow.removeListener("close", onWindowClose);
    if (onBeforeQuit) app.removeListener("before-quit", onBeforeQuit);
    didAttachShutdownHooks = false;
    onWindowClose = null;
    onBeforeQuit = null;
  }

  // Attach now
  attachShutdownHooks();

  /* ---- Cleanup ---- */
  return () => {
    unsubscribe?.();
    detachShutdownHooks();
    CHANNELS.forEach((ch) => ipcMain.removeHandler(ch));
  };
}