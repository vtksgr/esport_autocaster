<template>
  <div class="bg-slate-700 border border-slate-600 rounded p-3">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <!-- Live status dot -->
        <span
          class="inline-block w-3 h-3 rounded-full"
          :class="isStreaming
            ? 'bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.25)]'
            : 'bg-slate-400 opacity-70'"
          :title="isStreaming ? 'LIVE' : 'Not Live'"
        />
        <span class="text-slate-200 font-medium">
          {{ isStreaming ? 'LIVE' : 'OFFLINE' }}
        </span>
      </div>

      <div class="text-right">
        <div class="text-xs text-slate-400">Platform</div>
        <div class="text-slate-100 font-semibold">{{ platformLabel }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from "vue";
import { useRtmpStatus } from "@/controllers/rtmp.status.js";

import {
  isStreaming,
  bootstrap as bootstrapStreamState,
} from "@/controllers/obs.stream.controller.js";

const { platform } = useRtmpStatus();

const platformLabel = computed(() => {
  switch ((platform.value || "").toLowerCase()) {
    case "youtube": return "YouTube";
    case "twitch": return "Twitch";
    case "facebook": return "Facebook";
    case "custom": return "Custom RTMP(S)";
    default: return platform.value || "Unknown";
  }
});

onMounted(async () => {
  try { await bootstrapStreamState?.(); } catch {}
});
</script>
