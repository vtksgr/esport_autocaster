import { getClient, assertConnected, sleep } from "./obs.shared.js";

/* -------------------------
 Get recording status
-------------------------- */
export async function getRecordStatus() {
  assertConnected();
  const s = await getClient().call("GetRecordStatus");
  return { ...s, outputActive: !!s?.outputActive };
}
/* -------------------------
    start recording
-------------------------- */
export async function startRecording() {
  assertConnected();
  const obs = getClient();

  // idempotent pre-check (optional)
  try {
    const r = await obs.call("GetRecordStatus");
    if (r?.outputActive) return { ok: true, alreadyActive: true };
  } catch { /* ignore */ }

  return obs.call("StartRecord");
}
/* -------------------------
    stop recording
-------------------------- */
export async function stopRecording() {
  assertConnected();
  const obs = getClient();

  try {
    const r = await obs.call("GetRecordStatus");
    if (!r?.outputActive) return { ok: true, alreadyStopped: true };
  } catch { /* ignore */ }

  try {
    await obs.call("StopRecord");
  } catch (e) {
    const msg = e?.message || String(e);
    if (/not\s+active|already|stopp?ing/i.test(msg)) return { ok: true, noop: true };
    throw e;
  }

  for (let i = 0; i < 25; i++) {
    try {
      const r = await obs.call("GetRecordStatus");
      if (!r?.outputActive) break;
    } catch { /* ignore */ }
    await sleep(120);
  }
  return { ok: true };
}
