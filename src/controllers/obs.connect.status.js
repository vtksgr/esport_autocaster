//esports-autocaster\src\controllers\obs.connect.status.js
import { ref, computed } from "vue";

export const state = ref("disconnected"); // "connected" | "unstable" | "disconnected"

let _offPush = null;
let _pollTimer = null;
let _reconnectTimer = null;

export const label = computed(() => {
  if (state.value === "connected") return "OBS is connected";
  if (state.value === "unstable") return "OBS connection unstable";
  return "OBS is disconnected";
});

export async function pollOnce() {
  try {
    const s = await window.api.invoke("obs:getState");
    state.value = s || "disconnected";
  } catch {
    state.value = "disconnected";
  }
}

export async function tryConnect() {
  try {
    await window.api.invoke("obs:connect"); // uses saved config if none passed
  } catch {
    // ignore; we'll retry
  }
}

function attachPush() {
  if (!window.api?.onObsState) return () => {};
  const off = window.api.onObsState((s) => {
    state.value = s || "disconnected";
  });
  return off;
}

function startPolling() {
  stopPolling();
  // initial poll immediately
  void pollOnce();
  _pollTimer = setInterval(pollOnce, 5000);
}

function stopPolling() {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
}

function startAutoReconnect() {
  stopAutoReconnect();
  // try once now, then retry every 5s while not connected
  void tryConnect();
  _reconnectTimer = setInterval(() => {
    if (state.value !== "connected") void tryConnect();
  }, 5000);
}

function stopAutoReconnect() {
  if (_reconnectTimer) {
    clearInterval(_reconnectTimer);
    _reconnectTimer = null;
  }
}
/**
 * Start watching OBS connection:
 *  - subscribes to push events
 *  - starts polling as a safety net
 *  - auto-reconnect while disconnected
 * Returns a cleanup function.
 */
export function startStatusWatcher() {
  _offPush = attachPush();
  startPolling();
  if (state.value !== "connected") startAutoReconnect();

  return () => {
    _offPush?.();
    _offPush = null;
    stopPolling();
    stopAutoReconnect();
  };
}