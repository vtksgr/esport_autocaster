// src/controllers/obs.rtmps.controller.js
import { ref, computed } from "vue";

export const PRESETS = [
  { id: "youtube",  label: "YouTube",  url: "rtmp://a.rtmp.youtube.com/live2" },
  { id: "twitch",   label: "Twitch",   url: "rtmp://live.twitch.tv/app" },
  { id: "facebook", label: "Facebook", url: "rtmps://live-api-s.facebook.com:443/rtmp/" },
  { id: "custom",   label: "Custom",   url: "" },
];

const selPlatform = ref("youtube");
const serverUrl   = ref(PRESETS[0].url);
const streamKey   = ref("");
const busy        = ref(false);
const errorMsg    = ref("");
const infoMsg     = ref("");

export const selected = selPlatform;
export const server   = serverUrl;
export const key      = streamKey;
export const loading  = busy;
export const lastError = errorMsg;
export const message   = infoMsg;

export const isCustom = computed(() => selPlatform.value === "custom");
export const readonlyServer = computed(() => !isCustom.value);

export function setPlatform(p) {
  selPlatform.value = p;
  const preset = PRESETS.find(x => x.id === p);
  if (preset) {
    serverUrl.value = preset.url || "";
  }
}

export async function loadCurrentFromObs() {
  try {
    busy.value = true;
    errorMsg.value = "";
    const res = await window.api.invoke("obs:getStreamServiceSettings");
    // res: { streamServiceType, streamServiceSettings: { server, key, ... } }
    const srv = res?.streamServiceSettings?.server || "";
    const keyNow = res?.streamServiceSettings?.key || "";

    // Try to match one of our presets by prefix
    const match = PRESETS.find(p => p.url && srv.startsWith(p.url));
    if (match) {
      selPlatform.value = match.id;
      serverUrl.value   = match.url;
    } else {
      selPlatform.value = "custom";
      serverUrl.value   = srv;
    }
    streamKey.value = keyNow || "";
  } catch (e) {
    errorMsg.value = e?.message || String(e);
  } finally {
    busy.value = false;
  }
}

export async function validateUrl() {
  const platform = selPlatform.value;
  const server = serverUrl.value;
  try {
    await window.api.invoke("obs:validateRtmpUrl", { platform, server });
    return true;
  } catch (e) {
    errorMsg.value = e?.message || String(e);
    return false;
  }
}

/** Apply = write to OBS, but keep the form as-is */
export async function applyToObs() {
  try {
    busy.value = true;
    errorMsg.value = "";
    message.value = "";

    // If preset, ensure the server matches the preset exactly
    if (selPlatform.value !== "custom") {
      const preset = PRESETS.find(p => p.id === selPlatform.value);
      serverUrl.value = preset?.url || serverUrl.value;
    }

    const ok = await validateUrl();
    if (!ok) return;

    await window.api.invoke("obs:setStreamServiceSettings", {
      platform: selPlatform.value,
      server: serverUrl.value,
      key: streamKey.value,
    });
    message.value = "Applied stream settings to OBS.";
  } catch (e) {
    errorMsg.value = e?.message || String(e);
  } finally {
    busy.value = false;
  }
}

/** Cancel = discard form edits, reload what OBS currently has */
export async function cancelChanges() {
  await loadCurrentFromObs();
  message.value = "Reverted to OBS’s current settings.";
}

/** OK = Apply, then (optionally) you can close the modal from caller */
export async function okAndClose() {
  await applyToObs();
  // caller can watch `message` / `lastError` or emit an event to close UI
}
