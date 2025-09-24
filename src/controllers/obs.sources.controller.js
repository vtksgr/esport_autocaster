// src/controllers/obs.sources.controller.js
// Renderer-side helper to add media sources via Electron IPC (no direct obs-websocket in renderer).

/**
 * Add an image/video/audio file as a source into a given scene.
 * @param {Object} opts
 * @param {string} opts.sceneName
 * @param {string} opts.sourceName
 * @param {string} opts.filePath - Absolute path on disk
 * @param {('image'|'video'|'audio')} opts.kind
 */
export async function addMediaToScene({ sceneName, sourceName, filePath, kind }) {
  if (!window?.api?.invoke) throw new Error("IPC bridge (window.api.invoke) is not available");
  const isImage = kind === "image";
  const inputKind = isImage ? "image_source" : "ffmpeg_source";

  const inputSettings = isImage
    ? { file: filePath }                       // image
    : { local_file: filePath, looping: true }; // video/audio

  return await window.api.invoke("obs:input:create", {
    sceneName,
    inputName: sourceName,
    inputKind,
    inputSettings,
    sceneItemEnabled: true,
  });
}
