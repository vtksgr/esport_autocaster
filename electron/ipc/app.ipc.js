// electron/ipc/app.ipc.js
import { ipcMain, BrowserWindow } from "electron";
import { registerIpc } from "./ipc/app.ipc.js";


export function registerIpc(mainWindow) {

const APP_CHANNELS = ["app:reload"];

  // Ensure clean (hot reload / dev)
  APP_CHANNELS.forEach((ch) => ipcMain.removeHandler(ch));
   // View → Reload equivalent; used by the RefreshCw button
   ipcMain.handle("app:reload", () => {
     const win = BrowserWindow.getFocusedWindow() || mainWindow;
     win?.webContents?.reload();
     return { ok: true };
   });

  cleanupIpc = registerIpc(mainWindow);

  // Return composed cleanup
  return () => {
    cleanupObs?.();
    APP_CHANNELS.forEach((ch) => ipcMain.removeHandler(ch));
  };
}
