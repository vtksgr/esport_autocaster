// src/controllers/obs.program.display.controller.js
import { ref } from "vue";

export const hint  = ref("");
export const error = ref("");
export const busy  = ref(false);

let _videoEl = null;
let _currentStream = null;

// timers / listeners
let _statusTimer = null;          // short OBS status poll (optional)
let _watchdogTimer = null;        // long-running gentle retry loop
let _deviceChangeHandler = null;
let _visHandler = null;

/** Stop & release the current MediaStream (if any). */
export function detachStream() {
  try { _currentStream?.getTracks?.().forEach(t => t.stop()); } catch {}
  _currentStream = null;
  if (_videoEl) {
    _videoEl.srcObject = null;
    try { _videoEl.pause?.(); } catch {}
  }
}

/** Set the <video> element that should render the Virtual Cam. */
export function setVideoElement(el) {
  _videoEl = el || null;
  // belt-and-suspenders: ensure autoplay/inline on real node
  if (_videoEl) {
    _videoEl.muted = true;
    _videoEl.autoplay = true;
    _videoEl.setAttribute?.("playsinline", "");
  }
}

/** One-time getUserMedia to unlock labels (may fail; it's okay). */
async function ensureLabelAccess() {
  try {
    const t = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    t.getTracks().forEach(tr => tr.stop());
  } catch {}
}

async function listVideoInputs() {
  try { return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput"); }
  catch { return []; }
}

function looksLikeObs(labelOrId = "") {
  return /(obs.*virtual|virtual.*obs)/i.test(labelOrId);
}

async function openByDeviceId(deviceId) {
  return navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId } },
    audio: false
  });
}

/** Return a MediaStream for the OBS Virtual Camera only (no fallback). */
async function getObsVirtualCamStream() {
  await ensureLabelAccess();

  // First, try by label (fast path after reloads)
  const inputs = await listVideoInputs();
  const labeled = inputs.find(d => looksLikeObs(`${d.label} ${d.deviceId}`));
  if (labeled) {
    hint.value = "";
    return openByDeviceId(labeled.deviceId);
  }

  // If labels not visible, brute-force when OBS says it's active
  let status = {};
  try { status = await window.api.invoke("obs:getVirtualCamStatus"); } catch {}
  if (status?.outputActive) {
    for (const d of inputs) {
      try {
        const s = await openByDeviceId(d.deviceId);
        const vtrack = s.getVideoTracks?.()[0];
        const tlabel = vtrack?.label || "";
        if (looksLikeObs(tlabel) || status.outputActive) {
          hint.value = "";
          return s;
        }
        s.getTracks().forEach(t => t.stop());
      } catch { /* try next */ }
    }
  }

  hint.value = "OBS Virtual Camera not found yet. Make sure it is active in OBS.";
  throw new Error("OBS Virtual Camera not detected");
}

/** Attach (or re-attach) the Virtual Cam to the video element and ensure it plays. */
export async function attachStream() {
  if (!_videoEl) return;
  error.value = "";

  try {
    const s = await getObsVirtualCamStream();
    detachStream();
    _currentStream = s;
    _videoEl.srcObject = s;

    // Nudge playback reliably
    const tryPlay = async () => {
      try { await _videoEl.play(); } catch {}
    };
    if (_videoEl.readyState >= 1) await tryPlay();
    else _videoEl.onloadedmetadata = () => { tryPlay(); };

  } catch (e) {
    error.value = e?.message || String(e);
  }
}

/** Short OBS status poll used on first mount. */
async function startShortStatusPoll({ intervalMs = 800, maxTries = 20 } = {}) {
  let tries = 0;
  clearInterval(_statusTimer);
  _statusTimer = setInterval(async () => {
    tries += 1;
    try {
      const status = await window.api.invoke("obs:getVirtualCamStatus");
      if (status?.outputActive) {
        try {
          await attachStream();
          if (_currentStream) {
            clearInterval(_statusTimer);
            _statusTimer = null;
            return;
          }
        } catch {}
      }
    } catch {}
    if (tries >= maxTries) {
      clearInterval(_statusTimer);
      _statusTimer = null;
      // leave hint for watchdog to continue working
    }
  }, intervalMs);
}

/** Gentle watchdog: every 1s, if no working preview, try to recover/attach. */
function startWatchdog() {
  clearInterval(_watchdogTimer);
  _watchdogTimer = setInterval(async () => {
    try {
      // If we already have a stream but video isn't playing, kick it.
      const hasStream = !!_currentStream;
      const notRendering = _videoEl && _videoEl.srcObject && _videoEl.readyState >= 2 && _videoEl.paused;
      if (hasStream && notRendering) {
        try { await _videoEl.play(); } catch {}
        return;
      }

      // If no stream yet, but OBS says active, attempt attach.
      if (!hasStream) {
        let status = {};
        try { status = await window.api.invoke("obs:getVirtualCamStatus"); } catch {}
        if (status?.outputActive) await attachStream();
      }
    } catch { /* keep looping */ }
  }, 1000);
}

/** Call on mount: attach immediately if active; otherwise start watchers. */
export async function bootstrapProgramPreview() {
  // 1) Optimistic immediate attach (helps on reload)
  try { await attachStream(); if (_currentStream) hint.value = ""; } catch {}

  // 2) Show helpful hint if not yet streaming
  if (!_currentStream) hint.value = "Virtual Cam is not active yet.";

  // 3) Start short poll (first ~16s) and long-running watchdog
  await startShortStatusPoll();
  startWatchdog();

  // 4) React when device list changes
  if (navigator?.mediaDevices && !_deviceChangeHandler) {
    _deviceChangeHandler = async () => {
      if (!_currentStream) {
        try { await attachStream(); } catch {}
      }
    };
    navigator.mediaDevices.addEventListener("devicechange", _deviceChangeHandler);
  }
  if (window.api?.onVirtualCamChanged) {
    window.api.onVirtualCamChanged(async ({ outputActive }) => {
      if (outputActive) {
        try {
          await attachStream();
        } catch {}
      } else {
        detachStream();
        hint.value = "Virtual Cam is not active yet.";
      }
    });
  }

  // 5) Retry when window becomes visible (helps some Electron builds)
  if (!_visHandler) {
    _visHandler = async () => {
      if (document.visibilityState === "visible" && !_currentStream) {
        try { await attachStream(); } catch {}
      }
    };
    window.addEventListener("visibilitychange", _visHandler);
  }
}

/** Optional manual controls */
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
  clearInterval(_statusTimer);      _statusTimer = null;
  clearInterval(_watchdogTimer);    _watchdogTimer = null;

  if (_deviceChangeHandler && navigator?.mediaDevices) {
    navigator.mediaDevices.removeEventListener("devicechange", _deviceChangeHandler);
  }
  _deviceChangeHandler = null;

  if (_visHandler) {
    window.removeEventListener("visibilitychange", _visHandler);
  }
  _visHandler = null;

  detachStream();
  _videoEl = null;
}
