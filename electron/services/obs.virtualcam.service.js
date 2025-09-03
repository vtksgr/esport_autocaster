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
export async function stopVirtualCam(){ 
    assertConnected(); 
    return getClient().call("StopVirtualCam"); 
}
