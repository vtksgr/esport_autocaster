// src/controllers/obs.program.display.controller.js
import { ref } from "vue";

export const hint  = ref("");
export const error = ref("");
export const busy  = ref(false);

let _videoEl = null;
let _currentStream = null;

/** Stop & release the current MediaStream (if any). */
export function detachStream() {
  try {
    _currentStream?.getTracks?.().forEach(t => t.stop());
  } catch {}
  _currentStream = null;
  if (_videoEl) _videoEl.srcObject = null;
}

/** Set the <video> element that should render the Virtual Cam. */
export function setVideoElement(el) {
  _videoEl = el || null;
}

/** Some platforms need a one-time getUserMedia to reveal device labels. */
async function ensureLabelAccess() {
  try {
    const t = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    t.getTracks().forEach(tr => tr.stop());
  } catch {
    // ignore; labels may still be hidden but we’ll try matching anyway
  }
}

/** Return a MediaStream for the OBS Virtual Camera if available (fallback to default camera). */
async function getObsVirtualCamStream() {
  await ensureLabelAccess();

  const devices = await navigator.mediaDevices.enumerateDevices();
  const obsCam = devices.find(d =>
    d.kind === "videoinput" && /obs.*virtual/i.test(`${d.label} ${d.deviceId}`)
  );

  const constraints = obsCam
    ? { video: { deviceId: { exact: obsCam.deviceId } }, audio: false }
    : { video: true, audio: false };

  if (!obsCam) {
    hint.value = "OBS Virtual Camera not found; using default camera. Start Virtual Cam in OBS.";
  } else {
    hint.value = "";
  }

  return navigator.mediaDevices.getUserMedia(constraints);
}

/** Attach (or re-attach) the Virtual Cam (or fallback) to the video element. */
export async function attachStream() {
  if (!_videoEl) return;
  error.value = "";
  try {
    const s = await getObsVirtualCamStream();
    detachStream();
    _currentStream = s;
    _videoEl.srcObject = s;
  } catch (e) {
    error.value = e?.message || String(e);
  }
}

/** Call on mount: if Virtual Cam is already active, attach immediately; otherwise show a hint. */
export async function bootstrapProgramPreview() {
  try {
    const status = await window.api.invoke("obs:getVirtualCamStatus"); // { outputActive }
    if (status?.outputActive) {
      await attachStream();
    } else {
      hint.value = "Virtual Cam is not active yet.";
    }
  } catch (e) {
    // Likely not connected to OBS yet—don’t treat as fatal
    hint.value = "Waiting for OBS… Virtual Cam will appear when active.";
  }
}

/** (Optional helpers if you want manual control buttons somewhere) */
export async function startVirtualCamAndAttach() {
  try {
    busy.value = true;
    await window.api.invoke("obs:startVirtualCam");
    await attachStream();
  } catch (e) {
    error.value = e?.message || String(e);
  } finally {
    busy.value = false;
  }
}
export async function stopVirtualCam() {
  try {
    busy.value = true;
    await window.api.invoke("obs:stopVirtualCam");
  } catch (e) {
    error.value = e?.message || String(e);
  } finally {
    busy.value = false;
    detachStream();
  }
}

/** Clean up on unmount. */
export function cleanupProgramPreview() {
  detachStream();
  _videoEl = null;
}
