// electron/ipc/app.ipc.js
// Single entry for IPC registration. Delegates all OBS channels to obs.ipc.js.

import { ipcMain /*, BrowserWindow*/ } from "electron";
import { registerObsIpc } from "./obs.ipc.js";

/**
 * Register all IPC handlers used by the app.
 * Keep app-level channels here; OBS-specific channels live in obs.ipc.js.
 *
 * @param {import('electron').BrowserWindow} mainWindow
 * @returns {() => void} cleanup function to remove handlers
 */
export function registerIpc(mainWindow) {
  // If you add non-OBS app channels later, define them here.
  // Example scaffold:
  const APP_CHANNELS = [
    // "app:ping",
  ];

  // Ensure clean (hot reload / dev)
  APP_CHANNELS.forEach((ch) => ipcMain.removeHandler(ch));

  // Example of a non-OBS app handler (uncomment if/when needed)
  // ipcMain.handle("app:ping", () => "pong");

  // Delegate OBS handlers to its module.
  const cleanupObs = registerObsIpc(mainWindow);

  // Return composed cleanup
  return () => {
    cleanupObs?.();
    APP_CHANNELS.forEach((ch) => ipcMain.removeHandler(ch));
  };
}
