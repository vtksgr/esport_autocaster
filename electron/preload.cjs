// electron/preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  onObsState: (cb) => {
    const fn = (_evt, state) => cb(state);
    ipcRenderer.on("obs:state", fn);
    return () => ipcRenderer.off("obs:state", fn);
  },
});
