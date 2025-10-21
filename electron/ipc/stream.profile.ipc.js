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
  const safe = String(name ?? "").trim();
  if (!safe) return { ok: false, error: "Invalid profile name" };

  try {
    await createStreamProfile(safe);
    return { ok: true, data: { created: true } };
  } catch (err) {
    if (err && (err.code === 601 || String(err.message || "").toLowerCase().includes("exists"))) {
      return { ok: true, data: { created: false, reason: "already-exists" } };
    }
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("obs:profile:select", async (_e, { name }) => {
  const safe = String(name ?? "").trim();
  if (!safe) return { ok: false, error: "Invalid profile name" };

  await selectProfile(safe);
  return { ok: true };
});

ipcMain.handle("obs:profile:state", async (_e, { name }) => {
  const safe = String(name ?? "").trim();
  if (!safe) return { ok: false, error: "Invalid profile name" };

  const state = await getProfileState(safe);
  return { ok: true, data: state };
});


ipcMain.handle("obs:profile:ensure-defaults", async (_e, { name }) => {
  const safe = String(name ?? "").trim();
  if (!safe) return { ok: false, error: "Invalid profile name" };

  try {
    const result = await ensureDefaultScenesAndSources(safe);
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
