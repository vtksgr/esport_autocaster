<template>
  <div class="flex items-center justify-between bg-white shadow rounded-lg px-4 py-2 w-72">
    <div class="flex flex-col">
      <span class="text-sm font-semibold text-gray-700">OBS接続状況</span>
      <span class="text-xs mt-0.5"
        :class="{
          'text-green-600': state === 'connected',
          'text-yellow-600': state === 'unstable',
          'text-gray-500': state === 'disconnected'
        }">
        {{ label }}
      </span>
    </div>

    <span class="w-3.5 h-3.5 rounded-full"
      :class="{
        'bg-green-500': state === 'connected',
        'bg-yellow-400': state === 'unstable',
        'bg-gray-400': state === 'disconnected'
      }" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";

const state = ref("disconnected"); // "connected" | "unstable" | "disconnected"
let offPush, pollTimer, reconnectTimer;

const label = computed(() => {
  if (state.value === "connected") return "OBS is connected";
  if (state.value === "unstable")  return "OBS connection unstable";
  return "OBS is disconnected";
});

async function pollOnce() {
  try {
    const s = await window.api.invoke("obs:getState");
    // console.log("poll obs:getState =>", s);
    state.value = s || "disconnected";
  } catch (e) {
    // console.warn("obs:getState failed:", e);
    state.value = "disconnected";
  }
}

async function tryConnect() {
  try {
    const res = await window.api.invoke("obs:connect"); // uses saved config if none passed
    // console.log("obs:connect =>", res);
  } catch (e) {
    // console.error("obs:connect failed:", e);
  }
}

function startAutoReconnect() {
  // try to connect immediately, then every 5s while not connected
  tryConnect();
  reconnectTimer = setInterval(() => {
    if (state.value !== "connected") tryConnect();
  }, 5000);
}

onMounted(async () => {
  if (!window.api) {
    console.error("window.api is undefined (check preload.cjs & BrowserWindow options).");
    return;
  }

  // listen for push events
  offPush = window.api.onObsState((s) => {
    // console.log("push obs:state =>", s);
    state.value = s;
  });

  // get current state + start polling as a safety net
  await pollOnce();
  pollTimer = setInterval(pollOnce, 5000);

  // auto-connect flow
  if (state.value !== "connected") startAutoReconnect();
});

onUnmounted(() => {
  offPush?.();
  clearInterval(pollTimer);
  clearInterval(reconnectTimer);
});
</script>
