import { getClient, isConnected } from "../connection/obs.connect.js";

export function assertConnected() {
  if (!isConnected()) throw new Error("Not connected to OBS");
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export { getClient, isConnected };
