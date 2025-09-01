// electron/ipc/obs.ipc.js
import { ipcMain } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { connect as obsConnect, disconnect as obsDisconnect } from '../connection/obs.connect.js';
import {
  getSceneCollections,
  getScenesAndSourcesForCurrentCollection,
  getScenesAndSourcesForCollection,
  setSceneCollection,
  getScenes,
  switchScene,
  startStreaming,
  stopStreaming,
  getStatus,
} from '../services/obs.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_PATH = join(__dirname, '..', 'config.json');

async function loadConfig() {
  try { return JSON.parse(await readFile(CONFIG_PATH, 'utf-8')); }
  catch { return { url: 'ws://127.0.0.1:4455', password: '' }; }
}
async function saveConfig(cfg) { await writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8'); }

export function registerObsIpc() {
  // 🔒 Make this idempotent: remove prior handlers if hot-registered
  const CHANNELS = [
    'obs:connect','obs:disconnect',
    'obs:getSceneCollections','obs:setSceneCollection',
    'obs:getScenesAndSourcesForCurrentCollection','obs:getScenesAndSourcesForCollection',
    'obs:get-scenes','obs:switch-scene','obs:startStreaming','obs:stopStreaming','obs:getStatus',
    'obs:getConfig','obs:saveConfig',
  ];
  CHANNELS.forEach(ch => ipcMain.removeHandler(ch));

  // Connect / Disconnect
  ipcMain.handle('obs:connect', async (_evt, opts = {}) => {
    const cfg = await loadConfig();
    const url = opts.url || opts.host || cfg.url || 'ws://127.0.0.1:4455';
    const supplied = typeof opts.password === 'string' ? opts.password.trim() : '';
    const password = supplied || cfg.password || '';
    console.log('[IPC] obs:connect', url, 'pwd?', password ? 'yes' : 'no', `(source: ${supplied ? 'renderer' : 'config'})`);
    return obsConnect({ url, password });
  });
  ipcMain.handle('obs:disconnect', () => obsDisconnect());

  // Collections
  ipcMain.handle('obs:getSceneCollections', () => getSceneCollections());
  ipcMain.handle('obs:setSceneCollection', (_e, { name }) => setSceneCollection(name));

  // Scenes + sources
  ipcMain.handle('obs:getScenesAndSourcesForCurrentCollection', () => getScenesAndSourcesForCurrentCollection());
  ipcMain.handle('obs:getScenesAndSourcesForCollection', (_e, arg = {}) => {
    // Accept string or object with several possible keys
    const name =
      typeof arg === 'string'
        ? arg
        : arg.name || arg.sceneCollectionName || arg.collection || arg.sceneCollection;

    const peek = typeof arg.peek === 'boolean' ? arg.peek : true;
    const pauseMs = Number.isFinite(arg.pauseMs) ? arg.pauseMs : 250;

    return getScenesAndSourcesForCollection(name, { peek, pauseMs });
  });

  // Legacy / extras
  ipcMain.handle('obs:get-scenes', () => getScenes());
  ipcMain.handle('obs:switch-scene', (_e, sceneName) => switchScene(sceneName));
  ipcMain.handle('obs:startStreaming', () => startStreaming());
  ipcMain.handle('obs:stopStreaming', () => stopStreaming());
  ipcMain.handle('obs:getStatus', () => getStatus());

  // Config endpoints
  ipcMain.handle('obs:getConfig', () => loadConfig());
  ipcMain.handle('obs:saveConfig', (_e, cfg) => saveConfig(cfg));
}
