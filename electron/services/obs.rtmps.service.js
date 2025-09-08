// electron/services/obs.rtmps.service.js
import { getClient } from "../connection/obs.connect.js";
import { assertConnected } from "./obs.shared.js";

/* -----------------------------------
   RTMP(S) Stream Settings Service
----------------------------------- */

export const RTMP_DEFAULTS = {
  youtube:  "rtmp://a.rtmp.youtube.com/live2",
  twitch:   "rtmp://live.twitch.tv/app",
  facebook: "rtmps://live-api-s.facebook.com:443/rtmp/",
};

export function platformToKey(platformRaw) {
  const p = String(platformRaw || "").toLowerCase();
  if (p.startsWith("yt")) return "youtube";
  if (p.startsWith("face")) return "facebook";
  if (p.startsWith("tw")) return "twitch";
  if (p === "custom") return "custom";
  return p;
}

/** Read current OBS stream service settings */
export async function getStreamServiceSettings() {
  assertConnected();
  return getClient().call("GetStreamServiceSettings");
}

/** Validate platform vs URL (strict for presets, free for custom) */
export function validatePlatformAndUrl(platform, serverUrl) {
  const key = platformToKey(platform);
  if (key === "custom") return true;

  const expected = RTMP_DEFAULTS[key];
  if (!expected) throw new Error(`Unknown platform: ${platform}`);
  if (!serverUrl) throw new Error("Server URL is required.");

  if (!serverUrl.trim().startsWith(expected)) {
    throw new Error(
      `The server URL does not match the selected platform.\n` +
      `Platform: ${platform}  Expected prefix: ${expected}\n` +
      `Got: ${serverUrl}`
    );
  }
  return true;
}

/** Apply settings into OBS */
export async function setStreamServiceSettings({ platform, server, key }) {
  assertConnected();
  if (!platform) throw new Error("platform is required");
  if (!key) throw new Error("stream key is required");

  const p = platformToKey(platform);
  const serverUrl = p === "custom" ? (server || "") : RTMP_DEFAULTS[p];
  validatePlatformAndUrl(p, serverUrl);

  return getClient().call("SetStreamServiceSettings", {
    streamServiceType: "rtmp_custom",
    streamServiceSettings: {
      server: serverUrl,
      key,
    },
  });
}