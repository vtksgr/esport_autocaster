//esports-autocaster\electron\services\obs.stream.service.js
import { getClient, assertConnected, sleep } from "./obs.shared.js";

/* -------------------------
   get stream status
-------------------------- */
export async function getStatus() {
  assertConnected();
  const s = await getClient().call("GetStreamStatus");
  return { ...s, outputActive: !!s?.outputActive }; // stable shape
}
/* -------------------------
    start streaming
-------------------------- */
export async function startStreaming() {
  assertConnected();
  const obs = getClient();

  // idempotent pre-check
  try {
    const s = await obs.call("GetStreamStatus");
    if (s?.outputActive) return { ok: true, alreadyActive: true };
  } catch { /* ignore */ }

  try {
    await obs.call("StartStream");
    return { ok: true };
  } catch (e) {
    // try to provide a useful hint
    let hint = "";
    try {
      const svc = await obs.call("GetStreamServiceSettings");
      const type = svc?.streamServiceType || "";
      const settings = svc?.streamServiceSettings || {};
      if (!type || Object.keys(settings).length === 0) {
        hint = "No stream service configured in OBS (Settings → Stream).";
      }
    } catch {
      if (!hint) hint = "Unable to read stream service settings (likely not configured).";
    }

    const msg = e?.message || String(e);
    if (/already|active|starting/i.test(msg)) {
      return { ok: true, alreadyActive: true, note: "OBS reports streaming already active/starting." };
    }

    const error = new Error(`StartStream failed. ${hint || "Check OBS stream settings."} :: ${msg}`);
    error.code = e?.code ?? 500;
    throw error;
  }
}

/* -------------------------
   stop streaming
-------------------------- */
export async function stopStreaming() {
  assertConnected();
  const obs = getClient();

  try {
    const s = await obs.call("GetStreamStatus");
    if (!s?.outputActive) return { ok: true, alreadyStopped: true };
  } catch { /* ignore */ }

  try {
    await obs.call("StopStream");
  } catch (e) {
    const msg = e?.message || String(e);
    if (/not\s+active|already|stopp?ing/i.test(msg)) return { ok: true, noop: true };
    throw e;
  }

  // wait briefly until stopped
  for (let i = 0; i < 25; i++) {
    try {
      const s = await obs.call("GetStreamStatus");
      if (!s?.outputActive) break;
    } catch { /* ignore */ }
    await sleep(120);
  }
  return { ok: true };
}
