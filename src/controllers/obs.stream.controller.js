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

export async function refreshStreamStatus() {
  try {
    const s = await window.api.invoke("obs:getStatus");
    isStreaming.value = normalizeStreamActive(s);
  } catch {
    // don't hard-reset to false on transient errors
  }
}

/** optimistic + confirm */
export async function startStream() {
  try {
    await window.api.invoke("obs:startStreaming");
    // flip UI immediately on success
    isStreaming.value = true;
    lastError.value = "";

    // confirm with a short poll because OBS can lag a tick
    for (let i = 0; i < 10; i++) {
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
    await window.api.invoke("obs:stopStreaming");
    // flip UI immediately on success
    isStreaming.value = false;
    lastError.value = "";

    for (let i = 0; i < 10; i++) {
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
  if (loading.value) return;
  loading.value = true;
  lastError.value = "";

  const ok = isStreaming.value ? await stopStream() : await startStream();

  // If a start failed, ensure UI didn’t get stuck
  if (!ok && !isStreaming.value) {
    await refreshStreamStatus();
  }
  loading.value = false;
}

export const streamButtonText = computed(() =>
  isStreaming.value ? "配信終了" : "配信開始"
);

export const streamButtonClass = computed(() =>
  [
    "px-4 py-2 rounded text-sm font-medium transition",
    loading.value ? "opacity-70 cursor-not-allowed" : "hover:brightness-110",
    isStreaming.value ? "bg-green-500 text-white" : "bg-slate-400 text-slate-800",
  ].join(" ")
);

export async function bootstrap() {
  await refreshStreamStatus();
}
