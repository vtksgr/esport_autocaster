// C:\comworks\esports-autocaster\electron\main.js
import "dotenv/config";
import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {registerObsIpc} from "./ipc/obs.ipc.js";               // your app-level IPC
import { getClient, enableConsoleDebug, isConnected, connect as connectOBS, disconnect as disconnectOBS } from "./connection/obs.connect.js";
import { startVirtualCam, stopVirtualCam } from "./services/obs.virtualcam.service.js";
import { registerMediaIpc } from "./ipc/media.ipc.js";         // media management IPC
import { registerProfileIpc } from "./ipc/stream.profile.ipc.js";

/* ------------------
OBS Ops Log 
---------------------*/
//import { registerOpsLogIpc } from "./ipc/opslog.ipc.js";          
import { attachOpsLog } from "./services/obs.opslog.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
const isDev = !app.isPackaged && DEV_SERVER_URL.startsWith("http");

let mainWindow;
let cleanupIpc;
let isShuttingDown = false;

// ADD: attach ops-log exactly once after OBS is connected
let __opsLogAttached = false;
async function attachOpsLogOnce() {
  if (__opsLogAttached) return;
  try {
    const obs = getClient();               // uses your existing client
    attachOpsLog(obs, mainWindow);         // starts emitting "obs:opslog:append"
    __opsLogAttached = true;
    console.log("[opslog] attached");
  } catch (e) {
    console.warn("[opslog] not attached yet:", e?.message);
  }
}

async function createMainWindow() {
  enableConsoleDebug(true);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

 // --- Register a reload handler for the RefreshCw button (safe for dev hot-reloads) ---
 ipcMain.removeHandler("app:reload");
 ipcMain.handle("app:reload", () => {
   const win = BrowserWindow.getFocusedWindow() || mainWindow;
   if (win && !win.isDestroyed()) {
     win.webContents.reload();
   }
   return { ok: true };
 });

// Register IPC BEFORE loading renderer
 cleanupIpc = registerObsIpc(mainWindow);
  registerMediaIpc();
  registerProfileIpc();
 

//Defer import until after app is ready to avoid early app.getPath() usage
 const { registerOpsLogIpc } = await import("./ipc/opslog.ipc.js");
 registerOpsLogIpc();   
 if (isConnected()) {
  void attachOpsLogOnce();
} else {
  const __attachTimer = setInterval(() => {
    if (isConnected()) {
      void attachOpsLogOnce();
      clearInterval(__attachTimer);
    }
  }, 1000); // 1s polling; stops as soon as connected
}         // exposes 'obs:opslog:snapshot' safely

  // void connectAndAttach();

  if (isDev) {
    console.log("🔧 DEV MODE: loading", DEV_SERVER_URL);
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = path.join(__dirname, "..", "dist", "index.html");
    console.log("📦 PROD MODE: loading", indexPath);
    mainWindow.loadFile(indexPath);
  }

  mainWindow.once("ready-to-show", () => mainWindow.show());
}



/* ---------- App lifecycle: ALWAYS stop cam on quit ---------- */
async function gracefulShutdown() {
  try { await stopVirtualCam({ force: true }); } catch {}
  try { await disconnectOBS(); } catch {}
  try { if (typeof cleanupIpc === "function") cleanupIpc(); } catch {}
  try { ipcMain.removeHandler("app:reload"); } catch {}
}

app.on("before-quit", async (e) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  e.preventDefault();
  try {
    await gracefulShutdown();
  } finally {
    app.exit(0);
  }
});

app.on("window-all-closed", async () => {
  await gracefulShutdown();
  app.quit();
});

// Handle crashes/terminal signals too:
process.on("SIGINT", async () => { await gracefulShutdown(); process.exit(0); });
process.on("SIGTERM", async () => { await gracefulShutdown(); process.exit(0); });
process.on("uncaughtException", async (err) => {
  console.error("Uncaught exception:", err);
  await gracefulShutdown();
  process.exit(1);
});

app.whenReady().then(createMainWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
