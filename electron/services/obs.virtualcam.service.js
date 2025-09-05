//C:\comworks\esports-autocaster\electron\services\obs.virtualcam.service.js
import { getClient, isConnected } from "../connection/obs.connect.js";
function assertConnected(){ if(!isConnected()) throw new Error("Not connected to OBS"); }

export async function getVirtualCamStatus(){ 
    assertConnected(); 
    const s = await getClient().call("GetVirtualCamStatus"); 
    return { ...s, outputActive: !!s?.outputActive }; 
}
export async function startVirtualCam(){ 
    assertConnected(); 
    return getClient().call("StartVirtualCam"); 
}
export async function stopVirtualCam() {
  assertConnected();
  if (!isConnected()) return { note: "not_connected" };
  try {
    return await getClient().call("StopVirtualCam");
  } catch (e) {
    // if cam already stopped, ignore
    if (String(e?.message || "").includes("not active"))
      return { note: "not_active" };
    throw e;
  }
}
