// electron/ipc/stream.profile.ipc.js
import { ipcMain } from "electron";
import {
  listProfiles,
  createStreamProfile,
  selectProfile,
  getProfileState,
  ensureDefaultScenesAndSources,
  getCurrentSelection,
} from "../services/obs.profile.service.js";

import { isConnected } from "../connection/obs.connect.js";

export function registerProfileIpc() {
  ipcMain.handle("obs:profile:list", async () => {
    const list = await listProfiles();
    return { ok: true, data: list };
  });

  ipcMain.handle("obs:status", async () => {
  return { ok: true, data: { connected: !!isConnected() } };
});


  ipcMain.handle("obs:profile:create", async (_e, { name }) => {
  try {
    await createStreamProfile(name);
    return { ok: true, data: { created: true } };
  } catch (err) {
    // If the profile already exists (race / 601), treat as success
    if (err && (err.code === 601 || String(err.message || "").toLowerCase().includes("exists"))) {
      return { ok: true, data: { created: false, reason: "already-exists" } };
    }
    return { ok: false, error: String(err?.message || err) };
  }
});

  ipcMain.handle("obs:profile:select", async (_e, { name }) => {
    await selectProfile(name);
    return { ok: true };
  });

  ipcMain.handle("obs:profile:state", async (_e, { name }) => {
    const state = await getProfileState(name);
    return { ok: true, data: state };
  });


  // Safer: swallow benign 601 so renderer can still refresh
  ipcMain.handle("obs:profile:ensure-defaults", async (_e, { name }) => {
    try {
      const result = await ensureDefaultScenesAndSources(name);
      return { ok: true, data: result };
    } catch (err) {
      if (err?.code === 601) {
        return { ok: true, data: null, warn: String(err?.message || err) };
      }
      return { ok: false, error: String(err?.message || err) };
    }
  });

  // -------------------------------------------------------
  // NEW: read-only current selection (no switching in OBS)
  // -------------------------------------------------------
// Read-only current selection
  ipcMain.handle("obs:profile:current", async () => {
    const data = await getCurrentSelection();
    return { ok: true, data };
  });
}
