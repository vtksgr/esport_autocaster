<!-- src/views/Log.vue -->
<template>
  <section class="w-[95%] md:w-[80%] mx-auto py-6 space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h4 class="text-text-lg font-bold">ユーザー操作ログ</h4>
        <p class="text-xs text-gray-500">ライブ OBS イベント + スナップショット</p>
      </div>
      <div class="flex items-center gap-2">
        <select v-model="filter" class="border border-slate-500 bg-slate-800 rounded px-2 py-1 text-sm hover:border-slate-400 transition-colors duration-150">
          <option value="">All types</option>
          <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
        </select>
        <button @click="paused = !paused"
                class="px-3 py-1 rounded text-sm border border-slate-500 hover:border-slate-400 transition-colors duration-150"
                :class="paused ? 'bg-slate-600' : 'bg-slate-800'">
          {{ paused ? 'Resume autoscroll' : 'Pause autoscroll' }}
        </button>
        <button @click="rows = []" class="px-3 py-1 rounded  bg-slate-800 text-sm border border-slate-500 hover:border-slate-400 transition-colors duration-150">Clear view</button>
      </div>
    </header>

    <div ref="scrollBox"
         class="bg-black text-gray-100 rounded-lg p-3 h-[60vh] overflow-auto font-mono text-[12px] leading-5 border border-gray-700">
      <div v-for="(row, idx) in visible" :key="idx" class="whitespace-pre">
        <span class="text-gray-400">[{{ row.t }}]</span>
        <span class="ml-2 px-1.5 py-0.5 rounded text-black"
              :class="badgeClass(row.type)">{{ row.type }}</span>
        <span class="ml-2">{{ row.msg }}</span>
      </div>
      <div v-if="!visible.length" class="text-gray-400">No log lines.</div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from "vue";

const rows = ref([]);
const filter = ref("");
const paused = ref(false);
const types = ref(["stream","record","virtualcam","scene","transition","audio","source","filter","studio"]);
const scrollBox = ref(null);

function badgeClass(type) {
  switch (type) {
    case "stream": return "bg-green-400";
    case "record": return "bg-yellow-300";
    case "virtualcam": return "bg-sky-300";
    case "scene": return "bg-purple-300";
    case "transition": return "bg-rose-300";
    case "audio": return "bg-amber-300";
    case "source": return "bg-blue-300";
    case "filter": return "bg-teal-300";
    case "studio": return "bg-zinc-300";
    default: return "bg-gray-300";
  }
}

const visible = computed(() => filter.value
  ? rows.value.filter(r => r.type === filter.value)
  : rows.value
);

function autoscroll() {
  if (paused.value || !scrollBox.value) return;
  const el = scrollBox.value;
  const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
  if (nearBottom) el.scrollTop = el.scrollHeight;
}

onMounted(async () => {
  try {
    // 1) get the current snapshot (safe read)
    const snapshot = await window.api.invoke("obs:opslog:snapshot");
    rows.value = Array.isArray(snapshot) ? snapshot : [];
    await nextTick(); autoscroll();

    // 2) tail live lines (already broadcast by ops logger)
    const off = window.api.on("obs:opslog:append", (_entry) => {
      rows.value.push(_entry);
      if (rows.value.length > 2000) rows.value.shift();
      nextTick().then(autoscroll);
    });

    // optional cleanup if this view ever unmounts
    window.addEventListener("beforeunload", () => { try { off?.(); } catch {} });
  } catch (e) {
    console.error("Failed to load ops log:", e);
  }
});
</script>
