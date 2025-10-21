// electron/services/obs.profile.service.js
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  isConnected,
  connect as connectOBS,
  getClient,
} from "../connection/obs.connect.js";

const asFileUrl = (p) => pathToFileURL(p).href;
const ROOT = "C:\\comworks\\esports-autocaster\\src\\assets";

/** Canonical default scenes and source plan (plain JS). */
const DEFAULT_SCENES = ["StartingSoon", "InGame", "Break", "End"];
const REVERSED_DEFAULTS = [...DEFAULT_SCENES].reverse();

// ---------- helpers ----------
function sortByDefaultOrder(sceneNames) {
  const rank = new Map(DEFAULT_SCENES.map((n, i) => [n.toLowerCase(), i]));
  return [...sceneNames].sort((a, b) => {
    const ra = rank.has(a.toLowerCase()) ? rank.get(a.toLowerCase()) : 999;
    const rb = rank.has(b.toLowerCase()) ? rank.get(b.toLowerCase()) : 999;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}

async function removeDefaultSceneIfPresent(obs) {
  const { scenes, currentProgramSceneName } = await obs.call("GetSceneList");
  const def = scenes.find(s => s.sceneName.trim().toLowerCase() === "scene");
  if (!def) return;

  if (currentProgramSceneName?.trim().toLowerCase() === "scene") {
    const target = DEFAULT_SCENES.find(n => scenes.some(s => s.sceneName === n)) || scenes[0]?.sceneName;
    if (target) {
      await obs.call("SetCurrentProgramScene", { sceneName: target });
    }
  }

  try {
    await obs.call("RemoveScene", { sceneName: def.sceneName });
  } catch (e) {
    if (e?.code !== 601) throw e;
  }
}

/** Per-profile absolute assets (tweak here only). */
const PROFILE_ASSETS = {
  SK1: {
    startingSoon: {
      // (Your current file map – keeping as-is)
      image: path.join(ROOT, "frame", "sk1-ingame.png"),
      mediaLoop: path.join(ROOT, "background", "sk1-intro.mp4"),
      timerHtml: path.join(ROOT, "overlay", "sk1-countDownTimer.html"),
    },
    inGame: { overlayImage: path.join(ROOT, "frame", "sk1-ingame.png") },
    break: {
      mediaLoop: path.join(ROOT, "background", "sk1-break.mp4"),
      timerHtml: path.join(ROOT, "overlay", "sk1-countDownTimer.html"),
    },
    end: { endImage: path.join(ROOT, "frame", "sk1-end.png") },
  },
  SK2: {
    startingSoon: {
      image: path.join(ROOT, "frame", "sk2-intro.png"),
    },
    inGame: { overlayImage: path.join(ROOT, "frame", "sk2-ingame.png") },
    break: {
      image: path.join(ROOT, "frame", "sk2-break.png"),
      timerHtml: path.join(ROOT, "overlay", "sk2-countDownTimer.html"),
    },
    end: { endImage: path.join(ROOT, "frame", "sk2-end.png") },
  },
  SK3: {
    startingSoon: {
      // image: path.join(ROOT, "frame", "sk3-start.png"),
      mediaLoop: path.join(ROOT, "background", "sk3-intro.mp4"),
      timerHtml: path.join(ROOT, "overlay", "sk3-countDownTimer.html"),
    },
    inGame: { overlayImage: path.join(ROOT, "frame", "sk3-ingame.png") },
    break: {
      image: path.join(ROOT, "frame", "sk3-break.png"),
      timerHtml: path.join(ROOT, "overlay", "sk3-countDownTimer.html"),
    },
    end: { endImage: path.join(ROOT, "frame", "sk3-end.png") },
  },
};

/* -------------------------------------------------------------------------- */
/*                               OBS UTIL HELPERS                              */
/* -------------------------------------------------------------------------- */

async function ensureConnected() {
  if (!isConnected()) await connectOBS();
  return getClient();
}

async function fileMustExist(p, label) {
  try {
    await fs.access(p);
  } catch {
    throw new Error(`Missing required asset for ${label}: ${p}`);
  }
}

async function sceneExists(obs, sceneName) {
  const { scenes } = await obs.call("GetSceneList");
  return scenes.some((s) => s.sceneName === sceneName);
}

/** GLOBAL input utilities (single definitions) */
async function getInputByName(obs, inputName) {
  const { inputs } = await obs.call("GetInputList");
  const target = String(inputName ?? "").trim().toLowerCase();
  return inputs.find(i => i.inputName.trim().toLowerCase() === target) || null;
}

async function removeInputIfExists(obs, inputName) {
  const hit = await getInputByName(obs, inputName);
  if (!hit) return false;
  try {
    await obs.call("RemoveInput", { inputName: hit.inputName });
    return true;
  } catch (e) {
    if (e?.code !== 601) throw e;
    return false;
  }
}

/**
 * FIX: Upsert an input:
 * - creates if missing
 * - if exists and kind matches, updates settings (overlay=true)
 * - if exists and kind differs, removes + recreates
 * Always ensures it is attached to the target scene.
 */
async function upsertInput(obs, sceneName, inputName, inputKind, settings) {
  const existing = await getInputByName(obs, inputName);

  if (!existing) {
    const { sceneItemId } = await obs.call("CreateInput", {
      sceneName,
      inputName,
      inputKind,
      inputSettings: settings || {},
      sceneItemEnabled: true,
    });
    return sceneItemId;
  }

  // Ensure attached
  await attachExistingInputToScene(obs, sceneName, inputName);

  // Update settings if same kind
  const sameKind =
    existing.unversionedInputKind === inputKind ||
    existing.inputKind === inputKind;
  if (sameKind) {
    await obs.call("SetInputSettings", {
      inputName,
      inputSettings: settings || {},
      overlay: true,
    });
    return null;
  }

  // Replace if kind differs
  await obs.call("RemoveInput", { inputName });
  const { sceneItemId } = await obs.call("CreateInput", {
    sceneName,
    inputName,
    inputKind,
    inputSettings: settings || {},
    sceneItemEnabled: true,
  });
  return sceneItemId;
}

async function inputExistsGlobal(obs, inputName) {
  const { inputs } = await obs.call("GetInputList");
  return inputs.some((i) => i.inputName.trim().toLowerCase() === inputName.trim().toLowerCase());
}

async function renameInputIfExists(obs, oldName, newName) {
  const { inputs } = await obs.call("GetInputList");
  const hit = inputs.find((i) => i.inputName.trim().toLowerCase() === oldName.trim().toLowerCase());
  if (hit) {
    await obs.call("SetInputName", { inputName: hit.inputName, newInputName: newName });
    return true;
  }
  return false;
}

/** Scene creation that tolerates name collisions with existing inputs */
async function createSceneIfMissing(obs, sceneName) {
  if (await sceneExists(obs, sceneName)) return;

  if (await inputExistsGlobal(obs, sceneName)) {
    const renamed = await renameInputIfExists(obs, sceneName, `${sceneName} (Source)`);
    if (!renamed) {
      await renameInputIfExists(obs, sceneName, `${sceneName} (Source 1)`);
    }
  }

  try {
    await obs.call("CreateScene", { sceneName });
  } catch (err) {
    if (err?.code === 601) {
      if (await sceneExists(obs, sceneName)) return;
      if (await inputExistsGlobal(obs, sceneName)) {
        await renameInputIfExists(obs, sceneName, `${sceneName} (Source)`);
      }
      if (await sceneExists(obs, sceneName)) return;
    }
    throw err;
  }
}

/** Scene-level presence check */
async function inputExistsInScene(obs, sceneName, inputName) {
  const { sceneItems } = await obs.call("GetSceneItemList", { sceneName });
  const n = inputName.trim().toLowerCase();
  return sceneItems.some((it) => it.sourceName.trim().toLowerCase() === n);
}

/** Attach an existing global input to a scene (idempotent) */
async function attachExistingInputToScene(obs, sceneName, inputName) {
  if (await inputExistsInScene(obs, sceneName, inputName)) return;
  const { sceneItemId } = await obs.call("CreateSceneItem", {
    sceneName,
    sourceName: inputName,
    sceneItemEnabled: true,
  });
  return sceneItemId;
}

/**
 * Original helper (kept in case other code uses it).
 * Creates if missing; otherwise just attaches to the scene.
 */
async function createInputIfMissing(obs, sceneName, inputName, inputKind, settings) {
  if (!(await inputExistsGlobal(obs, inputName))) {
    try {
      const { sceneItemId } = await obs.call("CreateInput", {
        sceneName,
        inputName,
        inputKind,
        inputSettings: settings || {},
        sceneItemEnabled: true,
      });
      return sceneItemId;
    } catch (err) {
      if (err?.code !== 601) throw err;
    }
  }
  return await attachExistingInputToScene(obs, sceneName, inputName);
}

async function listInputs(obs) {
  const { inputs } = await obs.call("GetInputList");
  return inputs;
}

/* -------------------------------------------------------------------------- */
/*                                  PUBLIC API                                */
/* -------------------------------------------------------------------------- */

export async function listProfiles() {
  const obs = await ensureConnected();
  const { sceneCollections } = await obs.call("GetSceneCollectionList");

  const names = (Array.isArray(sceneCollections) ? sceneCollections : [])
    .map((s) => {
      if (typeof s === "string") return s;
      if (s && typeof s === "object" && "sceneCollectionName" in s) return s.sceneCollectionName;
      return String(s ?? "");
    })
    .map((n) => String(n ?? "").trim())
    .filter(Boolean);

  return names;
}

export async function createStreamProfile(name) {
  const safe = String(name ?? "").trim();
  if (!safe) throw new Error("Invalid profile name");

  const obs = await ensureConnected();

  // create / switch to collection
  const { sceneCollections } = await obs.call("GetSceneCollectionList");
  const exists = (sceneCollections || []).some(
    (s) => String(s.sceneCollectionName ?? "").trim().toLowerCase() === safe.toLowerCase()
  );
  if (!exists) {
    try {
      await obs.call("CreateSceneCollection", { sceneCollectionName: safe });
    } catch (err) {
      if (!(err?.code === 601 || String(err?.message || "").toLowerCase().includes("exists"))) {
        throw err;
      }
    }
  }

  await obs.call("SetCurrentSceneCollection", { sceneCollectionName: safe });

  // Remove OBS’s default “Scene” BEFORE we create anything else
  await removeDefaultSceneIfPresent(obs);

  // Create in reverse to land in desired UI order (you already had this)
  for (const scn of REVERSED_DEFAULTS) {
    await createSceneIfMissing(obs, scn);
  }

  try { await obs.call("SetCurrentProgramScene", { sceneName: "StartingSoon" }); } catch {}

  // Belt-and-suspenders
  await removeDefaultSceneIfPresent(obs);

  try {
    const { scenes } = await obs.call("GetSceneList");
    console.log("[order check]", scenes.map(s => s.sceneName));
  } catch {}
}

export async function selectProfile(name) {
  const safe = String(name ?? "").trim();
  if (!safe) throw new Error("Invalid profile name");

  const obs = await ensureConnected();
  await obs.call("SetCurrentSceneCollection", { sceneCollectionName: safe });

  await removeDefaultSceneIfPresent(obs);
  try { await obs.call("SetCurrentProgramScene", { sceneName: "StartingSoon" }); } catch {}
}

export async function getProfileState(name) {
  const safe = String(name ?? "").trim();
  if (!safe) throw new Error("Invalid profile name");

  const obs = await ensureConnected();
  await obs.call("SetCurrentSceneCollection", { sceneCollectionName: safe });

  const { currentSceneCollectionName } = await obs.call("GetSceneCollectionList");
  const { scenes, currentProgramSceneName } = await obs.call("GetSceneList");

  const orderedSceneNames = sortByDefaultOrder(scenes.map(s => s.sceneName));

  const sceneStates = [];
  for (const sceneName of orderedSceneNames) {
    const { sceneItems } = await obs.call("GetSceneItemList", { sceneName });
    sceneStates.push({
      sceneName,
      sources: sceneItems.map((it) => ({
        sourceName: it.sourceName,
        sceneItemId: it.sceneItemId,
      })),
    });
  }

  const inputs = await listInputs(obs);
  const audio = inputs
    .filter((i) =>
      [
        "wasapi_input_capture",
        "wasapi_output_capture",
        "pulse_input_capture",
        "pulse_output_capture",
        "coreaudio_input_capture",
        "coreaudio_output_capture",
      ].includes(i.unversionedInputKind)
    )
    .map((i) => ({ inputName: i.inputName, kind: i.inputKind }));

  return {
    sceneCollection: currentSceneCollectionName,
    currentScene: currentProgramSceneName,
    scenes: sceneStates,
    audioInputs: audio,
  };
}

/**
 * Ensure default scenes + default static sources are present for a profile.
 * User-configurable sources (Mic/Webcam/Window) are created empty.
 *
 * FIX: switched to upsertInput so SK2 updates its own file paths instead of
 * inheriting SK1’s old settings when inputs already exist.
 */
export async function ensureDefaultScenesAndSources(profileName) {
  const safe = String(profileName ?? "").trim();
  if (!safe) throw new Error("Invalid profile name");

  const obs = await ensureConnected();
  await obs.call("SetCurrentSceneCollection", { sceneCollectionName: safe });

  // Remove the default "Scene" if OBS created it
  await removeDefaultSceneIfPresent(obs);

  // Create missing scenes ONCE in canonical order (remove duplicate loop)
  for (const scn of DEFAULT_SCENES) {
    await createSceneIfMissing(obs, scn);
  }

  const assets = PROFILE_ASSETS[profileName];
  if (!assets) {
    return await getProfileState(profileName);
  }

  // Validate files that must exist (only those specified)
  if (assets.startingSoon?.image)
    await fileMustExist(assets.startingSoon.image, `${profileName} StartingSoon image`);
  if (assets.startingSoon?.mediaLoop)
    await fileMustExist(assets.startingSoon.mediaLoop, `${profileName} StartingSoon media`);
  if (assets.startingSoon?.timerHtml)
    await fileMustExist(assets.startingSoon.timerHtml, `${profileName} StartingSoon timer`);

  if (assets.inGame?.overlayImage)
    await fileMustExist(assets.inGame.overlayImage, `${profileName} InGame overlay`);

  if (assets.break?.mediaLoop)
    await fileMustExist(assets.break.mediaLoop, `${profileName} Break media`);
  if (assets.break?.image)
    await fileMustExist(assets.break.image, `${profileName} Break image`);
  if (assets.break?.timerHtml)
    await fileMustExist(assets.break.timerHtml, `${profileName} Break timer`);

  if (assets.end?.endImage)
    await fileMustExist(assets.end.endImage, `${profileName} End image`);

  // --- StartingSoon ---
// --- StartingSoon ---
if (assets.startingSoon?.image) {
  await upsertInput(obs, "StartingSoon", "LogoImage", "image_source", {
    file: assets.startingSoon.image,
  });
} else {
  await removeInputIfExists(obs, "LogoImage");
}

if (assets.startingSoon?.mediaLoop) {
  await upsertInput(obs, "StartingSoon", "IntroVideoLoop", "ffmpeg_source", {
    local_file: assets.startingSoon.mediaLoop,
    looping: true,
  });
} else {
  // prevent bleed if SK2 has no intro video
  await removeInputIfExists(obs, "IntroVideoLoop");
}

if (assets.startingSoon?.timerHtml) {
  await upsertInput(obs, "StartingSoon", "CountdownTimer", "browser_source", {
    url: asFileUrl(assets.startingSoon.timerHtml),
    width: 1920,
    height: 1080,
  });
} else {
  // prevent bleed if SK2 has no timer
  await removeInputIfExists(obs, "CountdownTimer");
}


  // --- InGame ---
if (assets.inGame?.overlayImage) {
  await upsertInput(obs, "InGame", "OverlayImage", "image_source", {
    file: assets.inGame.overlayImage,
  });
} else {
  await removeInputIfExists(obs, "OverlayImage");
}
// keep user-configurable devices present
await upsertInput(obs, "InGame", "Webcam", "dshow_input", {});
await upsertInput(obs, "InGame", "Mic", "wasapi_input_capture", {});
await upsertInput(obs, "InGame", "WindowCapture", "window_capture", {});



// --- Break ---
if (assets.break?.mediaLoop) {
  await removeInputIfExists(obs, "BreakImage");
  await upsertInput(obs, "Break", "BreakVideoLoop", "ffmpeg_source", {
    local_file: assets.break.mediaLoop,
    looping: true,
  });
} else if (assets.break?.image) {
  await removeInputIfExists(obs, "BreakVideoLoop");
  await upsertInput(obs, "Break", "BreakImage", "image_source", {
    file: assets.break.image,
  });
} else {
  // neither provided → clean both to avoid bleed
  await removeInputIfExists(obs, "BreakVideoLoop");
  await removeInputIfExists(obs, "BreakImage");
}

if (assets.break?.timerHtml) {
  await upsertInput(obs, "Break", "BreakTimer", "browser_source", {
    url: asFileUrl(assets.break.timerHtml),
    width: 1920,
    height: 1080,
  });
} else {
  await removeInputIfExists(obs, "BreakTimer");
}



// --- End ---
if (assets.end?.endImage) {
  await upsertInput(obs, "End", "EndImage", "image_source", {
    file: assets.end.endImage,
  });
} else {
  await removeInputIfExists(obs, "EndImage");
}

  return await getProfileState(profileName);
}

/* -------------------------------------------------------------------------- */
/*                      Read-only current selection helper                     */
/* -------------------------------------------------------------------------- */

export async function getCurrentSelection() {
  const obs = await ensureConnected();
  const { currentSceneCollectionName } = await obs.call("GetSceneCollectionList");
  const { currentProgramSceneName } = await obs.call("GetSceneList");
  return {
    sceneCollection: currentSceneCollectionName,
    currentScene: currentProgramSceneName,
  };
}
