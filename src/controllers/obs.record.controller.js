// src/controllers/obs.record.controller.js
import { ref, computed } from "vue";

export const isRecording = ref(false);
export const loading     = ref(false);
export const lastError   = ref("");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeRecordActive(s) {
  if (typeof s === "boolean") return s;
  if (!s || typeof s !== "object") return false;
  return !!(s.outputActive ?? s.recording ?? s.active ?? s.isRecording);
}

export async function refreshRecordStatus() {
  try {
    const s = await window.api.invoke("obs:getRecordStatus");
    isRecording.value = normalizeRecordActive(s);
  } catch {
    // don't force false on transient startup/race
  }
}

/** optimistic + confirm */
export async function startRecord() {
  try {
    await window.api.invoke("obs:startRecording");
    // instant UI feedback
    isRecording.value = true;
    lastError.value = "";

    // OBS can lag a bit — confirm a few times
    for (let i = 0; i < 10; i++) {
      await sleep(150);
      await refreshRecordStatus();
      if (isRecording.value) break;
    }
    return true;
  } catch (e) {
    console.error("Unable to start recording. Check your settings.", e);
    lastError.value = e?.message || String(e);
    isRecording.value = false; // revert if we flipped early
    return false;
  }
}

/** optimistic + confirm */
export async function stopRecord() {
  try {
    await window.api.invoke("obs:stopRecording");
    isRecording.value = false;
    lastError.value = "";

    for (let i = 0; i < 10; i++) {
      await sleep(150);
      await refreshRecordStatus();
      if (!isRecording.value) break;
    }
    return true;
  } catch (e) {
    console.error("Unable to stop recording.", e);
    lastError.value = e?.message || String(e);
    return false;
  }
}

/** single toggle */
export async function toggleRecord() {
  if (loading.value) return;
  loading.value = true;
  lastError.value = "";

  const ok = isRecording.value ? await stopRecord() : await startRecord();

  // if a start failed, make sure UI isn't stuck
  if (!ok && !isRecording.value) {
    await refreshRecordStatus();
  }
  loading.value = false;
}

export const recordButtonText = computed(() =>
  isRecording.value ? "録画終了" : "録画開始"
);

export const recordButtonClass = computed(() =>
  [
    "px-4 py-[4.5px] rounded text-sm font-medium transition border border-slate-500",
    loading.value ? "opacity-70 cursor-not-allowed" : "hover:brightness-110",
    isRecording.value ? "bg-green-500 text-white" : "bg-slate-800 text-slate-400",
  ].join(" ")
);

export async function bootstrap() {
  // optional guard against startup race; harmless if disconnected
  try {
    const ok = await window.api.invoke("obs:isConnected");
    if (ok) await refreshRecordStatus();
    else window.api.onObsState?.(async (s) => {
      if (s === "connected") await refreshRecordStatus();
    });
  } catch {}
}
