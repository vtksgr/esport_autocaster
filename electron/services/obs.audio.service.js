import { ipcMain } from "electron";

// ...inside registerObsIpc(mainWindow)
ipcMain.handle("obs:getAudioInputs", async () => {
  try {
    const data = await listAudioInputs();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});
