// src/controllers/ipc.util.js
export async function invokeSafe(channel, payload) {
  if (!window?.api?.invoke) {
    throw new Error("IPC bridge not ready (window.api.invoke missing)");
  }
  try {
    return await window.api.invoke(channel, payload);
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg.includes("No handler registered")) {
      throw new Error(`Backend not ready for "${channel}". Connect OBS and try again.`);
    }
    throw err;
  }
}
