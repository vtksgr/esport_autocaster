// electron/main.js
import "dotenv/config";
import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {registerObsIpc} from "./ipc/obs.ipc.js";               // your app-level IPC
import { enableConsoleDebug, isConnected, connect as connectOBS, disconnect as disconnectOBS } from "./connection/obs.connect.js";
import { startVirtualCam, stopVirtualCam } from "./services/obs.virtualcam.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
const isDev = !app.isPackaged && DEV_SERVER_URL.startsWith("http");

let mainWindow;
let cleanupIpc;
let isShuttingDown = false;

function createMainWindow() {
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

  // Register IPC BEFORE loading renderer
 cleanupIpc = registerObsIpc(mainWindow);

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
