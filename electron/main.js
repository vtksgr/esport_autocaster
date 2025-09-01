// electron/main.js
import "dotenv/config";
import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { registerIpc } from "./ipc/app.ipc.js";                 // <- single entry
import { enableConsoleDebug } from "./connection/obs.connect.js"; // optional: loud logs

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
const isDev = !app.isPackaged && DEV_SERVER_URL.startsWith("http");

let mainWindow;
let cleanupIpc;

function createMainWindow() {
  // Optional: verbose OBS connection logs in console
  enableConsoleDebug(true);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false, // show when ready, avoids white flash
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"), // keep preload separate + minimal
    },
  });

  // 🔴 IMPORTANT: Register IPC BEFORE loading the renderer to avoid race conditions
  cleanupIpc = registerIpc(mainWindow);

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

app.whenReady().then(createMainWindow);

app.on("window-all-closed", () => {
  // cleanly remove handlers so hot-reload / restart is stable
  cleanupIpc?.();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
