// electron/ipc/stream.profile.ipc.js
import { ipcMain } from "electron";
import {
  applyBuiltInProfile_SK1,
  updateInGameWindow,
  updateInGameCamera,
} from "../services/obs.profile.service.js";

export function registerProfileIpc() {
  // guard against double-register on hot-reloads
  ipcMain.removeHandler("obs:profile:apply");
  ipcMain.removeHandler("obs:profile:updateWindow");
  ipcMain.removeHandler("obs:profile:updateCamera");

  ipcMain.handle("obs:profile:apply", async (_evt, { name, options } = {}) => {
    if (name !== "SK1") throw new Error(`Unknown profile: ${name}`);
    return await applyBuiltInProfile_SK1(options || {});
  });

  ipcMain.handle("obs:profile:updateWindow", async (_evt, { windowTitle }) => {
    return await updateInGameWindow({ windowTitle });
  });

  ipcMain.handle("obs:profile:updateCamera", async (_evt, { cameraName, deviceId }) => {
    return await updateInGameCamera({ cameraName, deviceId });
  });

  console.log("[profile-ipc] handlers registered");
}
