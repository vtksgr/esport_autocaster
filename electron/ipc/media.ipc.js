// electron/ipc/media.ipc.js
import { ipcMain } from "electron";
import {
  // legacy-compatible
  legacy_getPreferredUploadsDir,
  legacy_listMedia,
  legacy_saveFiles,
  // public/category-aware
  getPublicDir,
  listAllMedia,
  saveToCategory,
  deleteMedia,
  renameMedia,
} from "../services/media.service.js";

export function registerMediaIpc() {
  // ---- Legacy channels (unchanged names) ----
  ipcMain.handle("media.ensureDir", () => legacy_getPreferredUploadsDir());
  ipcMain.handle("media.list",      () => legacy_listMedia());
  ipcMain.handle("media.save",      (_evt, payload) => legacy_saveFiles(payload));

  // ---- New public/category channels ----
  ipcMain.handle("media.public.dir",    () => getPublicDir());
  ipcMain.handle("media.public.list",   () => listAllMedia());
  ipcMain.handle("media.public.save",   (_evt, items) => saveToCategory(items));
  ipcMain.handle("media.public.delete", (_evt, absPath) => deleteMedia(absPath));
  ipcMain.handle("media.public.rename", (_evt, args) => renameMedia(args.absPath, args.newName));

  // Optional convenience alias
  ipcMain.handle("media.saveToPublic", (_evt, items) => saveToCategory(items));
}
