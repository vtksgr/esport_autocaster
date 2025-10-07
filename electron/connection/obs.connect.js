// electron/connection/obs.connect.js
import { OBSWebSocket } from "obs-websocket-js";
import { EventEmitter } from "node:events";

const obs = new OBSWebSocket();
const events = new EventEmitter();

/** "connected" | "unstable" | "disconnected" */
let state = "disconnected";
let connected = false;
let ready = false;

let DEBUG = false;
const COLOR = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

function log(...args) {if (DEBUG) console.log(...args);}

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
/* =========================
   NEW: readiness helpers
========================= */
function setReady(val) {
  if (ready !== !!val) {
    ready = !!val;
    log(`${COLOR.cyan}[OBS] ready${COLOR.reset} → ${ready ? COLOR.green + "true" : COLOR.yellow + "false"}${COLOR.reset}`);
    events.emit("ready", ready); // renderer can subscribe
  }
}
export function isReady() { return ready; }

/** Wait until OBS scene tree is ready (after collection switch). */
export async function waitReady({ timeout = 7000, step = 120 } = {}) {
  const start = Date.now();
  while (!ready) {
    if (Date.now() - start > timeout) throw new Error("OBS is not ready to perform the request.");
    await new Promise(r => setTimeout(r, step));
  }
}
/** Retry helper for calls that might hit code 207 right after a switch. */
export async function retry207(fn, { tries = 3, delay = 150 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) {
      const msg = e?.message || "";
      if (e?.code === 207 || msg.includes("not ready")) {
        lastErr = e;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}
/* =========================
   Public subscriptions
========================= */

export function onState(fn) {events.on("state", fn); try { fn(state); } catch {}
  return () => events.off("state", fn);
}
export function onReady(fn) {events.on("ready", fn); try { fn(ready); } catch {}
  return () => events.off("ready", fn);
}
export function onSceneList(fn) {events.on("scene-list", fn); try { fn([]); } catch {} return () => events.off("scene-list", fn);
}
/* =========================
   Connection management
========================= */
export function getState() {return state;}
export function isConnected() {return connected;}
export function getClient() {if (!connected) throw new Error("Not connected to OBS"); return obs;}

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
    setReady(false);

    log(`${COLOR.green}✅ [OBS] connected${COLOR.reset}`, { obsWebSocketVersion, negotiatedRpcVersion });

    // --- Hook readiness + scene list events immediately after connecting ---

obs.on("CurrentSceneCollectionChanging", () => {
  setReady(false);
});
obs.on("SceneListChanged", (payload) => {
  setReady(true);
  try {
    events.emit("scene-list", payload?.scenes || []);
  } catch {}
});
// Prime 'ready' on first connect if possible
try {
  const res = await obs.call("GetSceneList");
  setReady(true);
  try {
    events.emit("scene-list", res?.scenes || []);
  } catch {}
} catch {
  // ignore; SceneListChanged will flip ready later
}




    // --- OBS lifecycle events ---
    obs.on("ConnectionClosed", (info) => {
      connected = false;
      setReady(false); 
      setState("disconnected");
      console.warn(`${COLOR.red}[OBS] Connection closed${COLOR.reset}`, info || "");
    });

    // Fired after successful Identify step
    obs.on("Identified", (payload) => {
      log(`${COLOR.cyan}[OBS] Identified${COLOR.reset}`, payload || "");
      // if we re-identify after a hiccup, flip back to green
      setState("connected");
    });

 // After switching scene collections, OBS has the new scene tree.
 // Flip ready to true once GetSceneList succeeds (prevents long not-ready windows).
 obs.on("CurrentSceneCollectionChanged", async () => {
   try {
     await obs.call("GetSceneList");
     setReady(true);
   } catch {
     // If it's still warming up, SceneListChanged will flip ready soon after.
   }
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
const api = {
  connect,
  disconnect,
  getState,
  isConnected,
  getClient,
  onState,
  onReady,
  onSceneList, // NEW exports
  isReady,
  waitReady,
  retry207, // NEW exports
  enableConsoleDebug,
};
export default api;

// Auto-enable debug if env var is set
if (process?.env?.DEBUG_OBS === "1") enableConsoleDebug(true);
