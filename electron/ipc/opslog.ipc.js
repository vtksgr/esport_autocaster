// electron/ipc/opslog.ipc.js
import { ipcMain } from "electron";
import { getOpsLogSnapshot } from "../services/obs.opslog.service.js";


export function registerOpsLogIpc() {
     console.log("[opslog] registering obs:opslog:snapshot");
  try { ipcMain.removeHandler("obs:opslog:snapshot"); } catch {}
  ipcMain.handle("obs:opslog:snapshot", async () => getOpsLogSnapshot());
}
