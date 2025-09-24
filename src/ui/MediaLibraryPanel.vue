<!-- src/ui/MediaLibraryPanel.vue -->
<template>
  <div class="flex gap-4 h-[calc(100vh-6rem)]">
    <!-- LEFT: Single view + actions -->
    <aside class="w-96 border rounded-lg p-3 flex flex-col gap-3 bg-white">
      <div class="text-xs text-slate-500">
        Library: <span class="font-mono">{{ publicDir }}</span>
      </div>

      <div v-if="selected" class="space-y-2">
        <div class="text-sm font-medium truncate">{{ selected.name }}</div>
        <div class="text-xs text-slate-500">
          {{ selected.kind.toUpperCase() }} • {{ prettySize(selected.size) }}
        </div>

        <div class="border rounded-md bg-slate-50 h-56 flex items-center justify-center overflow-hidden">
          <template v-if="selected.kind === 'image'">
            <img :src="mediaUrl(selected)" alt="" class="max-h-56 object-contain" />
          </template>
          <template v-else-if="selected.kind === 'video'">
            <video :src="mediaUrl(selected)" class="max-h-56" controls />
          </template>
          <template v-else-if="selected.kind === 'audio'">
            <audio :src="mediaUrl(selected)" controls />
          </template>
          <template v-else>
            <span class="text-xs text-slate-400">No preview</span>
          </template>
        </div>

        <div class="space-y-2">
          <div class="text-xs">
            Path: <span class="font-mono break-all">{{ selected.path }}</span>
          </div>
          <div class="flex gap-2">
            <button class="px-2 py-1 rounded border" @click="copy(selected.path)">Copy path</button>
            <button class="px-2 py-1 rounded border" @click="renaming = true">Rename</button>
            <button class="px-2 py-1 rounded border border-red-300 text-red-700"
              @click="onDelete(selected)">Delete</button>
          </div>

          <div v-if="renaming" class="flex gap-2">
            <input v-model="renameTo" class="border rounded px-2 py-1 flex-1" placeholder="new-file-name.ext" />
            <button class="px-2 py-1 rounded bg-slate-900 text-white" @click="onRename">Save</button>
            <button class="px-2 py-1 rounded" @click="renaming=false">Cancel</button>
          </div>

          <div class="border-t pt-2">
            <div class="text-xs mb-1">Add to Scene:</div>
            <div class="flex gap-2 items-center">
              <input v-model="sceneName" class="border rounded px-2 py-1 flex-1"
                placeholder="Scene name (e.g. Program)" />
              <button class="px-3 py-1 rounded bg-sky-600 text-white" :disabled="!sceneName"
                @click="addToObs(selected)">Add</button>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="text-sm text-slate-500">Select a media from the right to preview & manage.</div>
    </aside>

    <!-- RIGHT: uploader + filters + grid -->
    <section class="flex-1 flex flex-col gap-3">
      <!-- category tabs -->
      <div class="flex gap-2 text-sm">
        <button v-for="c in categories" :key="c.key" class="px-3 py-1 rounded border"
          :class="activeCat === c.key ? 'bg-slate-900 text-white' : ''" @click="setCategory(c.key)">
          {{ c.label }}
        </button>
        <div class="ml-auto">
          <button class="px-2 py-1 rounded border" @click="refresh">Refresh</button>
        </div>
      </div>

      <!-- drop zone -->
      <div class="border-2 border-dashed rounded-lg p-6 text-center"
        :class="dragover ? 'border-sky-500 bg-sky-50' : 'border-slate-300'" @dragover.prevent="dragover = true"
        @dragleave.prevent="dragover = false" @drop.prevent="onDrop">
        <p class="font-medium">
          Drag & drop files into <b>{{ prettyCat(activeCat) }}</b>
        </p>
        <p class="text-xs text-slate-500">Or</p>
        <button class="px-3 py-1 mt-2 rounded bg-sky-600 text-white" @click="pick">Choose files</button>
        <input ref="fileInput" type="file" class="hidden" multiple accept="image/*,video/*,audio/*" @change="onChosen">
      </div>

      <!-- grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 overflow-auto pr-1">
        <div v-for="m in filtered" :key="m.path"
          class="p-3 border rounded-lg hover:ring-2 hover:ring-sky-400 cursor-pointer bg-white"
          @click="selected = m; renaming=false; renameTo=m.name">
          <div class="flex items-center justify-between">
            <div class="truncate">
              <div class="font-medium truncate">{{ m.name }}</div>
              <div class="text-xs text-slate-500">
                {{ m.category.toUpperCase() }} • {{ m.kind.toUpperCase() }} • {{ prettySize(m.size) }}
              </div>
            </div>
            <span class="text-xs px-2 py-0.5 rounded bg-slate-100">{{ m.ext }}</span>
          </div>

          <div
            class="h-28 mt-2 bg-slate-50 rounded flex items-center justify-center text-slate-500 text-xs overflow-hidden">
            <template v-if="m.kind==='image'">
              <img :src="mediaUrl(m)" alt="" class="max-h-28 object-contain">
            </template>
            <template v-else-if="m.kind==='video'">Video</template>
            <template v-else-if="m.kind==='audio'">Audio</template>
            <template v-else>File</template>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import {
  getPublicDir, listMediaPublic, saveFilesToCategory,
  deleteMedia as delMedia, renameMedia as rnMedia
} from "@/controllers/media.public.controller.js";
import { addMediaToScene } from "@/controllers/obs.sources.controller.js";

const publicDir = ref("");
const list = ref([]);
const selected = ref(null);
const dragover = ref(false);
const fileInput = ref(null);
// const query = ref("");

const categories = [
  { key: "overlays", label: "Overlays" },
  { key: "video", label: "Video" },
  { key: "audio", label: "Audio" },
];
// const overlaySubs = ["intro","game_play","break","end"];
const activeCat = ref("overlays");
// const activeSub = ref("intro");

const renaming = ref(false);
const renameTo = ref("");
const sceneName = ref("");

onMounted(async () => {
  publicDir.value = await getPublicDir();
  await refresh();
});

function prettySub(s) { return ({"game_play":"Game Play"}[s] ?? s).replace("_"," ").replace(/\b\w/g, m=>m.toUpperCase()); }
function prettyCat(c) { return c.charAt(0).toUpperCase() + c.slice(1); }
function prettySize(n) {
  const u = ["B","KB","MB","GB"]; let i=0; let s=n;
  while (s>1024 && i<u.length-1){ s/=1024; i++; }
  return `${s.toFixed(1)} ${u[i]}`;
}
function toFileUrl(p){ return `file:///${p.replace(/\\/g,"/")}`; }
/* ----------------------------------------------------------------------
Build a preview URL that works in both dev (http://localhost:5173) and prod (file://)
---------------------------------------------------------------------- */
function mediaUrl(m) {
  // If the renderer is loaded over HTTP (vite dev server), serve from /public via Vite
  if (typeof window !== "undefined" && window.location.protocol.startsWith("http")) {
    // m.rel is already relative to Public (e.g. "overlays/intro/img.png")
    const rel = (m?.rel || "").replace(/\\/g, "/");
    return "/" + rel.replace(/^\/+/, "");
  }
  // Otherwise (packaged app, file://) keep using absolute file paths
  return toFileUrl(m.path);
}

async function copy(t){ await navigator.clipboard.writeText(t); }

async function refresh(){
  const res = await listMediaPublic();
  list.value = res.items;
  if (selected.value && !list.value.find(i => i.path === selected.value.path)) selected.value = null;
}

const filtered = computed(() => {
  // const q = query.value.toLowerCase().trim();
  return list.value.filter(i => {
    if (activeCat.value && i.category !== activeCat.value) return false;
    // if (activeCat.value === "overlays" && activeSub.value && i.subcategory !== activeSub.value) return false;
    // if (q && !i.name.toLowerCase().includes(q)) return false;
    return true;
  });
});

function setCategory(cat){
  activeCat.value = cat;
  // if (cat !== "overlays") activeSub.value = "";
  // else if (!overlaySubs.includes(activeSub.value)) activeSub.value = "intro";
}

function pick(){ fileInput.value?.click(); }
async function onChosen(e){ await doUpload(Array.from(e.target.files || [])); e.target.value = ""; }
async function onDrop(e){ dragover.value = false; await doUpload(Array.from(e.dataTransfer.files || [])); }

async function doUpload(files){
  if (!files.length) return;
  // const opts = { category: activeCat.value, subcategory: activeCat.value==='overlays' ? activeSub.value : undefined };
  const opts = { category: activeCat.value };
  await saveFilesToCategory(opts, files);
  await refresh();
}

async function onDelete(item){
  if (!confirm(`Delete "${item.name}"?`)) return;
  await delMedia(item.path);
  await refresh();
  selected.value = null;
}

async function onRename(){
  if (!selected.value) return;
  const newName = renameTo.value.trim();
  if (!newName) return;
  await rnMedia(selected.value.path, newName);
  await refresh();
  selected.value = list.value.find(i => i.name === newName) || null;
  renaming.value = false;
}

async function addToObs(m){
  const base = m.name.replace(/\.[^.]+$/, "");
  const sourceName = base;
  await addMediaToScene({ sceneName: sceneName.value, sourceName, filePath: m.path, kind: m.kind });
}
</script>
