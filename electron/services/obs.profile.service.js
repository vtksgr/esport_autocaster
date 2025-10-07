//electron/services/obs.profile.service.js
import path from "node:path";
import { pathToFileURL } from "node:url";
import { app } from "electron";
import fs from "node:fs/promises";
import { isConnected, connect as connectOBS, getClient } from "../connection/obs.connect.js";

// ===== Meta / logging =====
export const PROFILE_SERVICE_VERSION = "profile-service@2025-10-03-06";
console.log("[obs.profile.service] loaded", PROFILE_SERVICE_VERSION);

const asFileUrl = p => pathToFileURL(p).href;
const RES_W = 1920, RES_H = 1080;

// ===== Assets =====
const ROOT = "C:\\comworks\\esports-autocaster\\src\\assets";

const PROFILE_ASSETS = {
  SK1: {
    startingSoon: path.join(ROOT, "background", "sk1-intro.mp4"),
    inGame:       path.join(ROOT, "frame",      "sk1-ingame.png"),
    break:        path.join(ROOT, "background", "sk1-break.mp4"),
    end:          path.join(ROOT, "frame",      "sk1-end.png"),
    timerIntro:   path.join(ROOT, "overlay",    "sk1-countDownTimer.html"),
    timerBreak:   path.join(ROOT, "overlay",    "sk1-countDownTimer.html"),
  },
  SK2: {
    startingSoon: path.join(ROOT, "frame", "sk2-intro.png"),
    inGame:       path.join(ROOT, "frame", "sk2-ingame.png"),
    break:        path.join(ROOT, "frame", "sk2-break.png"),
    end:          path.join(ROOT, "frame", "sk2-end.png"),
    timerIntro:   path.join(ROOT, "overlay", "sk2-countDownTimer.html"),
    timerBreak:   path.join(ROOT, "overlay", "sk2-countDownTimer.html"),
  },
  SK3: {
    startingSoon: path.join(ROOT, "background", "sk3-intro.mp4"),
    inGame:       path.join(ROOT, "frame",      "sk3-inGame.png"),
    break:        path.join(ROOT, "frame",      "sk3-break.png"),
    end:          path.join(ROOT, "frame",      "sk3-end.png"),
    timerIntro:   path.join(ROOT, "overlay",    "sk3-countDownTimer.html"),
    timerBreak:   path.join(ROOT, "overlay",    "sk3-countDownTimer.html"),
  }
};

// ===== OBS kinds =====
const KINDS = {
  MEDIA: "ffmpeg_source",
  BROWSER: "browser_source",
  IMAGE: "image_source",
  AUDIO_IN: "wasapi_input_capture",
};

// ===== Connect =====
async function ensureConnected() {
  if (!isConnected()) await connectOBS();
  return getClient();
}

// ===== Utilities =====
const isVideo = p => /\.(mp4|mov|mkv|webm)$/i.test(p || "");
const isImage = p => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(p || "");

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
async function mustExist(p, label) { if (!(await exists(p))) throw new Error(`Missing required asset "${label}": ${p}`); }

async function step(obs, requestType, args) {
  try { return await obs.call(requestType, args); }
  catch (e) {
    const msg = e?.message || (typeof e === "string" ? e : JSON.stringify(e));
    throw new Error(`${requestType} failed: ${msg}`);
  }
}

// Prefer a single `timer` asset, fall back to old keys
function normalizeAssets(Araw = {}) {
  const timer = Araw.timer ?? Araw.timerIntro ?? Araw.timerBreak;
  if (!timer) throw new Error("Timer asset not defined (timer | timerIntro | timerBreak)");
  return {
    startingSoon: Araw.startingSoon ?? Araw.introVideo,
    inGame:       Araw.inGame       ?? Araw.frame,
    break:        Araw.break        ?? Araw.breakVideo,
    end:          Araw.end          ?? Araw.endImage,
    timer,
  };
}

// ===== Collision-proof input helpers =====
async function getInput(obs, inputName) {
  const { inputs } = await obs.call("GetInputList");
  return inputs.find(i => i.inputName === inputName) || null;
}
async function sceneHasSource(obs, sceneName, inputName) {
  const { sceneItems } = await obs.call("GetSceneItemList", { sceneName });
  return sceneItems.some(i => i.sourceName === inputName);
}

async function ensureInputInScene(obs, {
  sceneName,
  inputName,
  inputKind,
  inputSettings,
  sceneItemEnabled = true,
}) {
  const existing = await getInput(obs, inputName);

  if (!existing) {
    try {
      await obs.call("CreateInput", {
        sceneName,
        inputName,
        inputKind,
        inputSettings,
        sceneItemEnabled
      });
      return;
    } catch (e) {
      const msg = e?.message || "";
      if (!/already exists by that input name/i.test(msg)) throw e;
      // race -> reuse path
    }
  }

  if (inputSettings && Object.keys(inputSettings).length) {
    await obs.call("SetInputSettings", { inputName, inputSettings, overlay: true });
  }

  if (!(await sceneHasSource(obs, sceneName, inputName))) {
    await obs.call("CreateSceneItem", { sceneName, sourceName: inputName, sceneItemEnabled });
  }
}

// typed wrappers
async function ensureMediaSource(obs, scene, name, filePath, loop = true) {
  await ensureInputInScene(obs, {
    sceneName: scene,
    inputName: name,
    inputKind: KINDS.MEDIA,
    inputSettings: {
      local_file: filePath,
      is_local_file: true,
      looping: loop,
      restart_on_activate: true,
      close_when_inactive: false
    }
  });
}
async function ensureBrowserSource(obs, scene, name, url, w = 1280, h = 720, fps = 30) {
  await ensureInputInScene(obs, {
    sceneName: scene,
    inputName: name,
    inputKind: KINDS.BROWSER,
    inputSettings: { url, width: w, height: h, fps, shutdown: false }
  });
}
async function ensureImageSource(obs, scene, name, filePath) {
  await ensureInputInScene(obs, {
    sceneName: scene,
    inputName: name,
    inputKind: KINDS.IMAGE,
    inputSettings: { file: filePath }
  });
}
async function ensureAudioInputDefault(obs, scene, name) {
  await ensureInputInScene(obs, {
    sceneName: scene,
    inputName: name,
    inputKind: KINDS.AUDIO_IN,
    inputSettings: { device_id: "", use_device_timing: true }
  });
}
async function ensureWindowCapture(obs, scene, name) {
  await ensureInputInScene(obs, {
    sceneName: scene,
    inputName: name,
    inputKind: "window_capture",
    inputSettings: { window: "", capture_method: "auto", capture_cursor: true }
  });
}
async function ensureCameraSource(obs, scene, name) {
  await ensureInputInScene(obs, {
    sceneName: scene,
    inputName: name,
    inputKind: "dshow_input",
    inputSettings: { device_id: "" }
  });
}

// ===== Public API =====
export async function createStreamProfile(name) {
  const obs = await ensureConnected();

  const A0 = PROFILE_ASSETS[name];
  if (!A0) throw new Error(`No absolute asset map defined for profile "${name}"`);
  const A = normalizeAssets(A0);

  console.log("[createStreamProfile] Using assets for", name, A);

  await mustExist(A.startingSoon, `${name} startingSoon`);
  await mustExist(A.inGame,       `${name} inGame`);
  await mustExist(A.break,        `${name} break`);
  await mustExist(A.end,          `${name} end`);
  await mustExist(A.timer,        `${name} timer (HTML)`);

  const { sceneCollections } = await step(obs, "GetSceneCollectionList", {});
  const already = sceneCollections.some(sc => sc.sceneCollectionName === name);
  if (!already) await step(obs, "CreateSceneCollection", { sceneCollectionName: name });
  await step(obs, "SetCurrentSceneCollection", { sceneCollectionName: name });

  const SCENES = ["1. StartingSoon", "2. InGame", "3. Break", "4. End"];
  const { scenes: existing } = await step(obs, "GetSceneList", {});
  const have = new Set(existing.map(s => s.sceneName));
  for (const s of SCENES) if (!have.has(s)) await step(obs, "CreateScene", { sceneName: s });
  await step(obs, "SetCurrentProgramScene", { sceneName: "1. StartingSoon" });

  // StartingSoon
  if (isVideo(A.startingSoon)) await ensureMediaSource(obs, "1. StartingSoon", "Intro", A.startingSoon, true);
  else if (isImage(A.startingSoon)) await ensureImageSource(obs, "1. StartingSoon", "Intro", A.startingSoon);
  await ensureBrowserSource(obs, "1. StartingSoon", "IntroTimer", asFileUrl(A.timer), RES_W, RES_H, 30);

  // InGame
  await ensureAudioInputDefault(obs, "2. InGame", "Mic/Aux (Default)");
  await ensureImageSource(obs, "2. InGame", "Overlay", A.inGame);
  await ensureWindowCapture(obs, "2. InGame", "Game Window");
  await ensureCameraSource(obs, "2. InGame", "Webcam");

  // Break
  if (isVideo(A.break)) await ensureMediaSource(obs, "3. Break", "Break", A.break, true);
  else if (isImage(A.break)) await ensureImageSource(obs, "3. Break", "Break", A.break);
  await ensureBrowserSource(obs, "3. Break", "BreakTimer", asFileUrl(A.timer), RES_W, RES_H, 30);

  // End
  await ensureImageSource(obs, "4. End", "End Image", A.end);

  return { ok: true, name };
}

export async function selectStreamProfile(name) {
  const obs = await ensureConnected();
  await obs.call("SetCurrentSceneCollection", { sceneCollectionName: name });

  const sceneList = await obs.call("GetSceneList");
  const scenes = [];
  for (const s of sceneList.scenes) {
    const items = await obs.call("GetSceneItemList", { sceneName: s.sceneName });
    const inputs = items.sceneItems.map(i => ({
      sceneItemId: i.sceneItemId,
      sourceName : i.sourceName,
      inputKind  : i.inputKind || null,
    }));
    scenes.push({ sceneName: s.sceneName, inputs });
  }

  scenes.sort((a, b) => {
    const na = parseInt(a.sceneName, 10), nb = parseInt(b.sceneName, 10);
    if (isNaN(na) || isNaN(nb)) return a.sceneName.localeCompare(b.sceneName);
    return na - nb;
  });

  const { inputs } = await obs.call("GetInputList");
  const audioInputs = inputs.filter(i =>
    String(i.inputKind).includes("wasapi") || String(i.inputKind).includes("audio"));

  return {
    sceneCollection: name,
    scenes,
    audio: audioInputs.map(i => ({ inputName: i.inputName, inputKind: i.inputKind })),
  };
}

// expose for IPC
export function getAssetsRoot() {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, "app.asar.unpacked")
    : app.getAppPath();
  return path.join(base, "assets");
}

export async function listSceneCollections() {
  const obs = await ensureConnected();
  const { sceneCollections } = await obs.call("GetSceneCollectionList");
  return sceneCollections.map(sc => sc.sceneCollectionName);
}
