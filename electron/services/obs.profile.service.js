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

/** Per-profile absolute assets (tweak here only). */
const PROFILE_ASSETS = {
  SK1: {
    startingSoon: {
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
  // Already exists as scene?
  if (await sceneExists(obs, sceneName)) return;

  // If a source globally uses this sceneName, rename it before creating the scene
  // (scene + source share the same global name namespace in OBS)
  if (await inputExistsGlobal(obs, sceneName)) {
    // try one deterministic rename
    const renamed = await renameInputIfExists(obs, sceneName, `${sceneName} (Source)`);
    if (!renamed) {
      // As a belt-and-suspenders, attempt a numbered suffix once
      await renameInputIfExists(obs, sceneName, `${sceneName} (Source 1)`);
    }
  }

  try {
    await obs.call("CreateScene", { sceneName });
  } catch (err) {
    // 601 can be a race or a stale conflict. Re-check and return if created meanwhile.
    if (err?.code === 601) {
      if (await sceneExists(obs, sceneName)) return;
      // If still failing, last attempt: make sure no source still claims the name
      // (another thread might have recreated it)
      if (await inputExistsGlobal(obs, sceneName)) {
        await renameInputIfExists(obs, sceneName, `${sceneName} (Source)`);
      }
      // Re-check once more
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
 * Create an input if missing globally; if it exists globally, just attach it
 * to the target scene. Truly idempotent for OBS v5 naming semantics.
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
      if (err?.code !== 601) throw err; // not a benign conflict
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
  return sceneCollections.map((s) => s.sceneCollectionName);
}

export async function createStreamProfile(name) {
  const obs = await ensureConnected();
  const { sceneCollections } = await obs.call("GetSceneCollectionList");
  const exists = sceneCollections.some((s) => s.sceneCollectionName.trim().toLowerCase() === name.trim().toLowerCase());

  if (!exists) {
    try {
      await obs.call("CreateSceneCollection", { sceneCollectionName: name });
    } catch (err) {
      // Treat benign races as "already exists"
      if (!(err?.code === 601 || String(err?.message || "").toLowerCase().includes("exists"))) {
        throw err;
      }
    }
  }

  await obs.call("SetCurrentSceneCollection", { sceneCollectionName: name });

  // Ensure the 4 default scenes exist (idempotent)
  for (const scn of DEFAULT_SCENES) {
    await createSceneIfMissing(obs, scn);
  }
}

export async function selectProfile(name) {
  const obs = await ensureConnected();
  await obs.call("SetCurrentSceneCollection", { sceneCollectionName: name });
}

export async function getProfileState(name) {
  const obs = await ensureConnected();

  // Switch to requested profile first so we query its state
  await obs.call("SetCurrentSceneCollection", { sceneCollectionName: name });

  const { currentSceneCollectionName } = await obs.call("GetSceneCollectionList");
  const { scenes, currentProgramSceneName } = await obs.call("GetSceneList");

  const sceneStates = [];
  for (const s of scenes) {
    const { sceneItems } = await obs.call("GetSceneItemList", { sceneName: s.sceneName });
    sceneStates.push({
      sceneName: s.sceneName,
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
 */
export async function ensureDefaultScenesAndSources(profileName) {
  const obs = await ensureConnected();
  await obs.call("SetCurrentSceneCollection", { sceneCollectionName: profileName });

  // Ensure scenes
  for (const scn of DEFAULT_SCENES) {
    await createSceneIfMissing(obs, scn);
  }

  const assets = PROFILE_ASSETS[profileName];
  if (!assets) {
    return await getProfileState(profileName);
  }

  // Validate files that must exist
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
  await createInputIfMissing(obs, "StartingSoon", "LogoImage", "image_source", {
    file: assets.startingSoon?.image || "",
  });
  await createInputIfMissing(obs, "StartingSoon", "IntroVideoLoop", "ffmpeg_source", {
    local_file: assets.startingSoon?.mediaLoop || "",
    looping: true,
  });
  await createInputIfMissing(obs, "StartingSoon", "CountdownTimer", "browser_source", {
    url: assets.startingSoon?.timerHtml ? asFileUrl(assets.startingSoon.timerHtml) : "",
    width: 1920,
    height: 1080,
  });

  // --- InGame ---
  await createInputIfMissing(obs, "InGame", "OverlayImage", "image_source", {
    file: assets.inGame?.overlayImage || "",
  });
  await createInputIfMissing(obs, "InGame", "Webcam", "dshow_input", {});
  await createInputIfMissing(obs, "InGame", "Mic", "wasapi_input_capture", {});
  await createInputIfMissing(obs, "InGame", "WindowCapture", "window_capture", {});

  // --- Break ---
  if (assets.break?.mediaLoop) {
    await createInputIfMissing(obs, "Break", "BreakVideoLoop", "ffmpeg_source", {
      local_file: assets.break.mediaLoop,
      looping: true,
    });
  } else if (assets.break?.image) {
    await createInputIfMissing(obs, "Break", "BreakImage", "image_source", {
      file: assets.break.image,
    });
  }
  await createInputIfMissing(obs, "Break", "BreakTimer", "browser_source", {
    url: assets.break?.timerHtml ? asFileUrl(assets.break.timerHtml) : "",
    width: 1920,
    height: 1080,
  });

  // --- End ---
  await createInputIfMissing(obs, "End", "EndImage", "image_source", {
    file: assets.end?.endImage || "",
  });

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
