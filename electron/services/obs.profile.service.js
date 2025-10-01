// electron/services/obs.profile.service.js
import path from "node:path";
import fs from "node:fs";
import { app } from "electron";
import { getClient } from "../connection/obs.connect.js";
import { assertConnected, sleep} from "./obs.shared.js";

/* -----------------------------------------------------------
   Helpers: project root + assets + file:// URL conversion
------------------------------------------------------------ */
function getProjectRoot() {
  // dev: <root>/electron exists one level up from app.getAppPath()
  const appPath = app.getAppPath();
  const parent = path.dirname(appPath);
  try { if (fs.existsSync(path.join(parent, "electron"))) return parent; } catch {}
  // prod: packaged — appPath is the root
  return appPath;
}

function resolveAssetsDir(sub) {
  const root = getProjectRoot();
  return path.join(root, "src", "assets", sub);
}

function firstFileOf(dir, exts) {
  try {
    const list = fs.readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isFile())
      .map(d => d.name)
      .filter(n => exts.includes(path.extname(n).toLowerCase()));
    if (list.length) return path.join(dir, list[0]);
  } catch {}
  return "";
}

function pathToFileUrl(p) {
  // Windows safe: file:///C:/path/… form
  const resolved = path.resolve(p);
  const withForward = resolved.replace(/\\/g, "/");
  return "file:///" + withForward.replace(/^\/+/, "");
}

/* -----------------------------------------------------------
   OBS helpers with gentle retries (no breaking existing)
------------------------------------------------------------ */
async function callWithRetry(fn, { tries = 6, delay = 160 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) {
      const msg = e?.message || "";
      // OBS “not ready”/207 window after collection switch
      if (msg.includes("not ready") || e?.code === 207) {
        last = e; await sleep(delay); continue;
      }
      throw e;
    }
  }
  throw last;
}

async function waitSceneTreeReady({ timeout = 7000, step = 140 } = {}) {
  // crude but reliable: poll GetSceneList until it succeeds twice
  assertConnected();
  const obs = getClient();
  const start = Date.now();
  let okCount = 0;
  while (Date.now() - start < timeout) {
    try {
      await obs.call("GetSceneList");
      okCount++;
      if (okCount >= 2) return;
      await sleep(step);
    } catch {
      await sleep(step);
    }
  }
}
/* -----------------------------------------------------------
   Idempotent ensure methods
------------------------------------------------------------ */
async function ensureSceneCollection(sceneCollectionName) {
  assertConnected();
  const obs = getClient();

  const { sceneCollections } = await obs.call("GetSceneCollectionList");
  const names = (sceneCollections || []).map(x => x?.sceneCollectionName || x?.name || String(x));

  if (!names.includes(sceneCollectionName)) {
    // Try create if supported by protocol
    try {
      await obs.call("CreateSceneCollection", { sceneCollectionName });
    } catch (e) {
      // If CreateSceneCollection isn’t supported, fall back:
      // SetCurrentSceneCollection will throw if it doesn’t exist.
      // We rethrow so user sees the missing support clearly.
      throw new Error(`CreateSceneCollection not supported: ${e?.message || e}`);
    }
  }

  // Switch into it (even if already current, safe)
  await obs.call("SetCurrentSceneCollection", { sceneCollectionName });
  await waitSceneTreeReady({});
}

async function sceneExists(sceneName) {
  const obs = getClient();
  const { scenes } = await obs.call("GetSceneList");
  return !!(scenes || []).find(s => s.sceneName === sceneName);
}

async function ensureScene(sceneName) {
  assertConnected();
  const obs = getClient();
  if (await sceneExists(sceneName)) return;
  await callWithRetry(() => obs.call("CreateScene", { sceneName }));
  await waitSceneTreeReady({});
}

async function getSceneItemId(sceneName, sourceName) {
  const obs = getClient();
  const { sceneItems } = await obs.call("GetSceneItemList", { sceneName });
  const item = (sceneItems || []).find(it => it.sourceName === sourceName);
  return item?.sceneItemId ?? 0;
}

async function ensureInput({ sceneName, inputName, inputKind, inputSettings, sceneItemEnabled = true }) {
  assertConnected();
  const obs = getClient();

  // Already in scene?
  const existingId = await getSceneItemId(sceneName, inputName);
  if (existingId) {
    // Update settings non-destructively
    try {
      await obs.call("SetInputSettings", { inputName, inputSettings, overlay: true });
    } catch { /* ignore to avoid breaking working rigs */ }
    return existingId;
  }

  const { input } = await callWithRetry(() =>
    obs.call("CreateInput", {
      sceneName,
      inputName,
      inputKind,
      inputSettings,
      sceneItemEnabled,
    })
  );
  return input?.sceneItemId || (await getSceneItemId(sceneName, inputName));
}

/* -----------------------------------------------------------
   Public API: apply SK1 + update helpers
------------------------------------------------------------ */
export async function applyBuiltInProfile_SK1({ windowTitle, cameraName } = {}) {
  assertConnected();

  // 1) Switch/create collection
  await ensureSceneCollection("SK1");

  // 2) Ensure scenes
  const scenes = ["StartingSoon", "InGame", "Break", "End"];
  for (const s of scenes) await ensureScene(s);

  // 3) Resolve assets (optional/may be missing)
  const logoImg      = firstFileOf(resolveAssetsDir("logo"),       [".png", ".jpg", ".jpeg", ".webp"]);
  const frameImg     = firstFileOf(resolveAssetsDir("frame"),      [".png", ".jpg", ".jpeg", ".webp"]);
  const bgVideo      = firstFileOf(resolveAssetsDir("background"), [".mp4", ".mov", ".mkv", ".webm", ".avi"]);
  const timerHtml    = firstFileOf(resolveAssetsDir("overley"),    [".html", ".htm"]);
  const breakTimer   = timerHtml; // same pool

  // 4) StartingSoon
  if (logoImg) {
    await ensureInput({
      sceneName: "StartingSoon",
      inputName: "Logo",
      inputKind: "image_source",
      inputSettings: { file: logoImg },
    });
  }
  if (bgVideo) {
    await ensureInput({
      sceneName: "StartingSoon",
      inputName: "BackgroundVideo",
      inputKind: "ffmpeg_source",
      inputSettings: { local_file: bgVideo, looping: true },
    });
  }
  if (timerHtml) {
    const fileUrl = pathToFileUrl(timerHtml);
    await ensureInput({
      sceneName: "StartingSoon",
      inputName: "CountdownTimer",
      inputKind: "browser_source",
      inputSettings: { is_local_file: true, local_file: timerHtml, url: fileUrl, width: 1920, height: 1080, fps: 30 },
    });
  }

  // 5) InGame
  if (frameImg) {
    await ensureInput({
      sceneName: "InGame",
      inputName: "Overlay",
      inputKind: "image_source",
      inputSettings: { file: frameImg },
    });
  }
  // Create placeholders; user can update later via update helpers
  await ensureInput({
    sceneName: "InGame",
    inputName: "GameWindow",
    inputKind: "window_capture",
    inputSettings: windowTitle ? { window: windowTitle } : {},
  });
  await ensureInput({
    sceneName: "InGame",
    inputName: "Camera",
    inputKind: process.platform === "win32" ? "dshow_input" : "av_capture_input",
    inputSettings: cameraName ? { device_name: cameraName } : {},
  });

  // 6) Break
  if (breakTimer) {
    const fileUrl = pathToFileUrl(breakTimer);
    await ensureInput({
      sceneName: "Break",
      inputName: "BreakTimer",
      inputKind: "browser_source",
      inputSettings: { is_local_file: true, local_file: breakTimer, url: fileUrl, width: 1920, height: 1080, fps: 30 },
    });
  }
  if (bgVideo) {
    await ensureInput({
      sceneName: "Break",
      inputName: "BreakLoop",
      inputKind: "ffmpeg_source",
      inputSettings: { local_file: bgVideo, looping: true },
    });
  }

  // 7) End
  const endImg = logoImg || frameImg;
  if (endImg) {
    await ensureInput({
      sceneName: "End",
      inputName: "EndImage",
      inputKind: "image_source",
      inputSettings: { file: endImg },
    });
  }

  // Optional: keep overlay on top in InGame
  try {
    const obs = getClient();
    const overlayId = await getSceneItemId("InGame", "Overlay");
    if (overlayId) await obs.call("SetSceneItemIndex", { sceneName: "InGame", sceneItemId: overlayId, sceneItemIndex: 999 });
  } catch { /* best effort */ }

  return { ok: true, profile: "SK1" };
}

/* ------ Update helpers user can call from UI later ------ */
export async function updateInGameWindow({ windowTitle }) {
  assertConnected();
  if (!windowTitle) throw new Error("windowTitle is required");
  const obs = getClient();
  await obs.call("SetInputSettings", {
    inputName: "GameWindow",
    inputSettings: { window: windowTitle },
    overlay: true,
  });
  return { ok: true };
}

export async function updateInGameCamera({ cameraName, deviceId }) {
  assertConnected();
  const obs = getClient();
  const settings = deviceId ? { device_id: deviceId } : { device_name: cameraName };
  await obs.call("SetInputSettings", {
    inputName: "Camera",
    inputSettings: settings,
    overlay: true,
  });
  return { ok: true };
}