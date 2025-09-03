//C:\comworks\esports-autocaster\src\controllers\obs.virtualcam.controller.js
import { ref } from "vue";

export const virtualCamActive = ref(false);
let _autoTried = false; // ensure we only auto-start once per app session

async function getStatus() {
  try {
    const s = await window.api.invoke("obs:getVirtualCamStatus");
    virtualCamActive.value = !!s?.outputActive;
  } catch {
    virtualCamActive.value = false;
  }
}

export async function startVirtualCam() {
  await window.api.invoke("obs:startVirtualCam");
  await getStatus();
}

export async function stopVirtualCam() {
  await window.api.invoke("obs:stopVirtualCam");
  await getStatus();
}

/**
 * Auto-start Virtual Cam exactly once, but only when:
 *  - OBS is connected
 *  - scene collections are loaded (non-empty, with a current selection)
 */
export async function ensureVirtualCamActiveOnce({ requireCollectionsReady } = {}) {
  if (_autoTried) return;
  _autoTried = true;

  try {
    const connected = await window.api.invoke("obs:isConnected");
    if (!connected) return;

    if (requireCollectionsReady) {
      const ok =
        Array.isArray(requireCollectionsReady.collections) &&
        requireCollectionsReady.collections.length > 0 &&
        !!requireCollectionsReady.currentCollection;
      if (!ok) return; // do not start if collections aren't ready
    }

    await getStatus();
    if (!virtualCamActive.value) {
      await startVirtualCam();
    }
  } catch {
    // swallow; user can still start manually
  }
}