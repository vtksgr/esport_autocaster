// src/controllers/obs.profile.controller.js
export async function listProfiles() {
  const res = await window.api.invoke("obs:profile:list");
  if (!res?.ok) throw new Error("obs:profile:list failed");
  return res.data || [];
}

export async function createProfile(name) {
  const res = await window.api.invoke("obs:profile:create", { name });
  if (!res?.ok) {
    // allow UI to continue if backend already handled existence
    throw new Error(res?.error || "obs:profile:create failed");
  }
  return res.data; // { created: true|false }
}


export async function selectProfile(name) {
  const res = await window.api.invoke("obs:profile:select", { name });
  if (!res?.ok) throw new Error("obs:profile:select failed");
}

export async function getProfileState(name) {
  const res = await window.api.invoke("obs:profile:state", { name });
  if (!res?.ok) throw new Error("obs:profile:state failed");
  return res.data;
}

export async function ensureDefaults(name) {
  const res = await window.api.invoke("obs:profile:ensure-defaults", { name });
  if (!res?.ok) throw new Error("obs:profile:ensure-defaults failed");
  return res.data;
}

// ✅ must exist in controller
export async function getCurrentSelection() {
  const res = await window.api.invoke("obs:profile:current");
  if (!res?.ok) throw new Error("obs:profile:current failed");
  return res.data; // { sceneCollection, currentScene }
}
export async function getObsStatus() {
  const res = await window.api.invoke("obs:status");
  if (!res?.ok) return { connected: false };
  return res.data || { connected: false };
}

