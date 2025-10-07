// C:\comworks\esports-autocaster\electron\ipc\stream.profile.ipc.js
import { ipcMain } from "electron";
import {
  createStreamProfile,
  selectStreamProfile,
  getAssetsRoot,
  listSceneCollections,
  PROFILE_SERVICE_VERSION
} from "../services/obs.profile.service.js";
import { enableConsoleDebug } from "../connection/obs.connect.js";

export function registerProfileIpc() {
  enableConsoleDebug?.();
  console.log("[ipc] registerProfileIpc using", PROFILE_SERVICE_VERSION);

  // Clean old handlers (prevents duplicates during dev/HMR)
  try {
    ipcMain.removeHandler("obs:profile:list");
    ipcMain.removeHandler("obs:profile:create");
    ipcMain.removeHandler("obs:profile:select");
    ipcMain.removeHandler("obs:profile:assetsRoot");
  } catch {}

  ipcMain.handle("obs:profile:list", async () => {
    try {
      const names = await listSceneCollections();
      return { ok: true, data: names };
    } catch (err) {
      console.error("obs:profile:list failed:", err);
      return { ok: false, error: friendly(err) };
    }
  });

  ipcMain.handle("obs:profile:create", async (_evt, { profileName, assetsDir }) => {
    try {
      const out = await createStreamProfile(profileName, assetsDir);
      return { ok: true, data: out };
    } catch (err) {
      console.error("obs:profile:create failed:", err);
      return { ok: false, error: friendly(err) };
    }
  });

  ipcMain.handle("obs:profile:select", async (_evt, { profileName }) => {
    try {
      const data = await selectStreamProfile(profileName);
      return { ok: true, data };
    } catch (err) {
      console.error("obs:profile:select failed:", err);
      return { ok: false, error: friendly(err) };
    }
  });

  ipcMain.handle("obs:profile:assetsRoot", async () => {
    try {
      return { ok: true, data: getAssetsRoot() };
    } catch (err) {
      console.error("obs:profile:assetsRoot failed:", err);
      return { ok: false, error: friendly(err) };
    }
  });
}

function friendly(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  const obj = { name: err.name, message: err.message, code: err.code, stack: err.stack };
  try { return JSON.stringify(obj, null, 2); } catch { return String(err); }
}
