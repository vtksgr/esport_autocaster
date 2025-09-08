// src/controllers/rtmp.status.js
import { reactive, computed } from "vue";

const state = reactive({ platform: "youtube" });

export function setRtmpPlatform(val) {
  state.platform = val || "custom";
}

export function useRtmpStatus() {
  return { platform: computed(() => state.platform) };
}
