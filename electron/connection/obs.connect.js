// electron/connection/obs.connect.js
import { OBSWebSocket } from "obs-websocket-js";
import { EventEmitter } from "node:events";

const obs = new OBSWebSocket();
const events = new EventEmitter();

/** "connected" | "unstable" | "disconnected" */
let state = "disconnected";
let connected = false;

let DEBUG = false;
const COLOR = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

function log(...args) {
  if (DEBUG) console.log(...args);
}

function prettyState(s) {
  if (s === "connected")   return `${COLOR.green}🟢 connected${COLOR.reset}`;
  if (s === "unstable")    return `${COLOR.yellow}🟡 unstable${COLOR.reset}`;
  return `${COLOR.gray}⚪ disconnected${COLOR.reset}`;
}

function setState(next) {
  if (state !== next) {
    const prev = state;
    state = next;
    log(`${COLOR.cyan}[OBS] state${COLOR.reset} ${prettyState(prev)} → ${prettyState(next)}`);
    events.emit("state", state);
  }
}

export function onState(fn) {
  events.on("state", fn);
  // fire current immediately for new subscribers
  try { fn(state); } catch {}
  return () => events.off("state", fn);
}

export function getState() {
  return state;
}

export function isConnected() {
  return connected;
}

export function getClient() {
  if (!connected) throw new Error("Not connected to OBS");
  return obs;
}

/**
 * Enable verbose console logging. Call this once from your main process.
 * Example:
 *   import { enableConsoleDebug } from "./connection/obs.connect.js";
 *   enableConsoleDebug(true);
 * Or set env: DEBUG_OBS=1
 */
export function enableConsoleDebug(on = true) {
  DEBUG = !!on;
  if (process?.env?.DEBUG_OBS === "1") DEBUG = true;
  log(`${COLOR.cyan}[OBS] debug logging enabled${COLOR.reset}`);
}

export async function connect({ url = "ws://127.0.0.1:4455", password } = {}) {
  if (connected) {
    log(`${COLOR.cyan}[OBS] connect called but already connected${COLOR.reset}`);
    return { status: "ok", alreadyConnected: true };
  }

  log(`${COLOR.cyan}[OBS] connecting to${COLOR.reset} ${url}  pwd? ${password ? "yes" : "no"}`);
  try {
    const { obsWebSocketVersion, negotiatedRpcVersion } = await obs.connect(url, password ?? "");
    connected = true;
    setState("connected");

    log(`${COLOR.green}✅ [OBS] connected${COLOR.reset}`, { obsWebSocketVersion, negotiatedRpcVersion });

    // --- OBS lifecycle events ---
    obs.on("ConnectionClosed", (info) => {
      connected = false;
      setState("disconnected");
      console.warn(`${COLOR.red}[OBS] Connection closed${COLOR.reset}`, info || "");
    });

    // Fired after successful Identify step
    obs.on("Identified", (payload) => {
      log(`${COLOR.cyan}[OBS] Identified${COLOR.reset}`, payload || "");
      // if we re-identify after a hiccup, flip back to green
      setState("connected");
    });

    // Generic client error
    obs.on("error", (e) => {
      console.warn(`${COLOR.yellow}[OBS] Client error${COLOR.reset}:`, e?.message || e);
      if (connected) {
        setState("unstable");
        setTimeout(() => setState(connected ? "connected" : "disconnected"), 1500);
      }
    });

    // Optional: log some useful state changes (comment out if noisy)
    obs.on("CurrentProgramSceneChanged", (p) => log("[OBS] Program scene →", p?.sceneName));
    obs.on("CurrentSceneCollectionChanged", (p) => log("[OBS] Scene collection →", p?.sceneCollectionName));
    obs.on("SceneCollectionListChanged", (p) => log("[OBS] Scene collection list changed:", p));

    return { status: "ok", obsWebSocketVersion, negotiatedRpcVersion };
  } catch (err) {
    connected = false;
    setState("disconnected");
    console.error(`${COLOR.red}❌ [OBS] connect failed${COLOR.reset}:`, err?.message || err);
    throw err;
  }
}

export async function disconnect() {
  try {
    await obs.disconnect();
  } catch (e) {
    log(`${COLOR.yellow}[OBS] disconnect error (ignored)${COLOR.reset}:`, e?.message || e);
  }
  connected = false;
  setState("disconnected");
  log(`${COLOR.cyan}[OBS] disconnected${COLOR.reset}`);
  return { status: "ok" };
}

// Keep named exports (preferred), but also provide a default bundle if you like importing as an object.
const api = { connect, disconnect, getState, isConnected, getClient, onState, enableConsoleDebug };
export default api;

// Auto-enable debug if env var is set
if (process?.env?.DEBUG_OBS === "1") enableConsoleDebug(true);
