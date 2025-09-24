// src/controllers/obs.stream.controller.js
import { ref, computed } from "vue";

export const isStreaming = ref(false);
export const loading     = ref(false);
export const lastError   = ref("");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeStreamActive(s) {
  if (typeof s === "boolean") return s;
  if (!s || typeof s !== "object") return false;
  return !!(s.outputActive ?? s.streaming ?? s.active ?? s.isStreaming);
}

// --------------------------------------
/** One place to call Electron IPC with nice errors */
async function invokeOrThrow(channel, ...args) {
  if (!window?.api?.invoke) {
    const e = new Error("Renderer bridge not ready (window.api.invoke missing).");
    console.error(e);
    throw e;
  }
  try {
    console.debug("[IPC] call:", channel, args);
    const res = await window.api.invoke(channel, ...args);
    console.debug("[IPC] ok:", channel, res);
    return res;
  } catch (e) {
    console.error(`[IPC] ${channel} failed:`, e);
    throw e;
  }
}



// --------------------------------------

export async function refreshStreamStatus() {
try {
    const s = await invokeOrThrow("obs:getStatus");
     isStreaming.value = normalizeStreamActive(s);
       } catch (e) {
    // don't hard-reset to false on transient errors; surface a hint once
    if (!lastError.value) lastError.value = String(e?.message || e);
    console.error("Unable to get stream status from OBS.", e);}
}

/** optimistic + confirm */
export async function startStream() {
try {
    await invokeOrThrow("obs:startStreaming");
    // flip UI immediately on success
    isStreaming.value = true;
    lastError.value = "";

    // confirm with a short poll because OBS can lag a tick (give it a bit longer)
 for (let i = 0; i < 20; i++) {
      await sleep(150);
      await refreshStreamStatus();
      if (isStreaming.value) break;
    }
    return true;
  } catch (e) {
    console.error("Unable to start stream. Check your settings.", e);
    lastError.value = e?.message || String(e);
    // revert optimistic state if we ever set it before failing
    isStreaming.value = false;
    return false;
  }
}

/** optimistic + confirm */
export async function stopStream() {
try {
    await invokeOrThrow("obs:stopStreaming");
    // flip UI immediately on success
    isStreaming.value = false;
    lastError.value = "";

   for (let i = 0; i < 20; i++) {
      await sleep(150);
      await refreshStreamStatus();
      if (!isStreaming.value) break;
    }
    return true;
  } catch (e) {
    console.error("Unable to stop stream.", e);
    lastError.value = e?.message || String(e);
    return false;
  }
}

/** Single toggle button */
 export async function toggleStream() {

console.debug("[UI] toggleStream click; loading=", loading.value, "isStreaming=", isStreaming.value);
 if (loading.value) return;
   loading.value = true;
   lastError.value = "";
 
   const ok = isStreaming.value ? await stopStream() : await startStream();
 

// If the action failed, re-sync once more so UI doesn’t get stuck
if (!ok) await refreshStreamStatus();
   loading.value = false;
 }
export const streamButtonText = computed(() =>
  isStreaming.value ? "配信終了" : "配信開始"
);

export const streamButtonClass = computed(() =>
  [
    "px-4 py-[4.5px] rounded text-sm font-medium transition border border-slate-500",
    loading.value ? "opacity-70 cursor-not-allowed" : "hover:brightness-110",
    isStreaming.value ? "bg-green-500 text-white" : "bg-slate-800 text-slate-400",
  ].join(" ")
);

export async function bootstrap() {
  await refreshStreamStatus();
}
