<template>
  <div class="flex gap-4 h-[calc(100vh-6rem)]">
    <!-- LEFT: Single view + actions -->
    <aside class="w-96 border border-slate-600 rounded p-3 flex flex-col gap-3 bg-slate-700">
      <div class="text-sm font-medium text-slate-500">
        <span class="rounded text-slate-300 bg-slate-600 px-2 py-0.5">ライブラリー</span>
      </div>

      <div v-if="selected" class="space-y-2 mt-4">
        <div class="flex items-center justify-between px-1">
          <div class="text-sm font-medium truncate">{{ selected.name }}</div>
          <div class="text-xs text-slate-500">{{ prettySize(selected.size) }}</div>
        </div>

        <div class="border rounded-md bg-slate-400 h-56 flex items-center justify-center overflow-hidden">
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
          <div class="text-xs text-slate-500">
            Path: <span class="font-mono break-all">{{ selected.path }}</span>
          </div>

          <div class="flex justify-between mt-4">
            <div class="flex gap-2">
              <button
                class="px-2 py-1 text-xs text-slate-300 rounded border border-slate-400 bg-slate-500 hover:bg-slate-700"
                @click="copy(selected.path)">パスをコピー</button>

              <button
                class="px-2 py-1 text-xs text-slate-300 rounded border border-slate-400 bg-slate-500 hover:bg-slate-700"
                @click="renaming = true">名前を変更</button>
            </div>

            <div>
              <button
                class="px-2 py-1 text-xs text-slate-300 rounded border border-slate-400 bg-slate-500 hover:bg-slate-700"
                @click="onDelete(selected)">削除</button>
            </div>
          </div>

          <!-- small faded status line -->
          <p v-if="statusMsg" class="mt-1 px-1 text-[11px]"
            :class="statusKind === 'ok' ? 'text-slate-400' : 'text-red-400'">
            {{ statusMsg }}
          </p>

          <div v-if="renaming" class="flex gap-2">
            <input v-model="renameTo"
              class="border border-slate-600 bg-slate-800 text-sm text-slate-300 rounded px-2 py-1 flex-1"
              placeholder="new-file-name.ext" />
            <button class="px-2 py-1 rounded text-sm bg-slate-900 text-slate-300 hover:bg-slate-800"
              @click="onRename">保存</button>
            <button class="px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-300"
              @click="renaming = false">キャンセル</button>
          </div>
        </div>
      </div>

      <div v-else class="text-xs text-slate-500">
        「プレビューと管理を行うには、右側からメディアを選択してください。」
      </div>
    </aside>

    <!-- RIGHT: uploader + filters + grid -->
    <section class="flex-1 flex flex-col gap-3">
      <!-- FILTER BUTTONS + REFRESH ICON -->
      <div class="flex gap-2 text-xs">
        <button v-for="f in filters" :key="f.key"
          class="px-3 py-1 text-slate-300 rounded border border-slate-600 bg-slate-700 hover:bg-slate-900"
          :class="activeFilter === f.key ? 'bg-slate-900 text-white' : ''" @click="setFilter(f.key)">
          {{ f.label }}
        </button>

        <div class="ml-auto">
          <button class="p-2 rounded border border-slate-600 bg-slate-700 hover:bg-slate-900" title="Reload"
            @click="onRefreshClick">
            <RefreshCw class="w-4 h-4" :class="spinning ? 'animate-spin' : ''" />
          </button>
        </div>
      </div>

      <!-- DROP ZONE -->
      <div class="border-2 border-dashed border-slate-400 rounded p-6 text-center bg-slate-800"
        :class="dragover ? 'border-sky-500 bg-sky-50' : 'border-slate-300'" @dragover.prevent="dragover = true"
        @dragleave.prevent="dragover = false" @drop.prevent="onDrop">
        <p class="text-sm text-slate-400">ファイルをドロップしてアップロード（画像 / ビデオ / オーディオ）</p>
        <p class="text-xs text-slate-500">保存先: <b>/public/media</b></p>
        <button class="px-3 py-2 mt-2 rounded bg-sky-600 text-slate-200 text-sm" @click="pick">ファイルを選択</button>
        <input ref="fileInput" type="file" class="hidden" multiple accept="image/*,video/*,audio/*"
          @change="onChosen" />
        <span class="text-xs text-slate-500 text-center block mt-2">最大アップロードサイズ: 150 MB。</span>
      </div>

      <!-- GRID -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 overflow-auto pr-1">
        <div v-for="m in filtered" :key="m.path"
          class="p-3 border border-slate-600 rounded-lg hover:ring-2 hover:ring-sky-400 cursor-pointer bg-slate-700"
          @click="select(m)">
          <div class="flex items-center justify-between">
            <div class="truncate">
              <div class="text-sm text-slate-300 font-medium truncate">{{ m.name }}</div>
              <div class="text-xs text-slate-500">
                {{ m.kind.toUpperCase() }} • {{ prettySize(m.size) }}
              </div>
            </div>
            <span class="text-xs px-2 pb-1 rounded bg-slate-500">{{ m.ext }}</span>
          </div>

          <div
            class="h-28 mt-2 bg-slate-500 rounded flex items-center justify-center text-slate-400 text-xs overflow-hidden">
            <!-- IMAGE -->
            <template v-if="m.kind === 'image'">
              <img :src="mediaUrl(m)" alt="" class="max-h-28 object-contain" />
            </template>

            <!-- VIDEO: show thumbnail (like OS). Falls back to a mini video panel if thumb not ready -->
            <template v-else-if="m.kind === 'video'">
              <img v-if="videoThumbs[m.path]" :src="videoThumbs[m.path]" alt="" class="w-full h-full object-cover" />
              <video v-else :src="mediaUrl(m)" class="w-full h-full object-cover opacity-70" muted playsinline
                preload="metadata" />
            </template>

            <!-- AUDIO: show real audio bar -->
            <template v-else-if="m.kind === 'audio'">
              <audio :src="mediaUrl(m)" class="w-full px-2" controls preload="metadata"></audio>
            </template>

            <!-- OTHER -->
            <template v-else>
              File
            </template>
          </div>

        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { RefreshCw } from "lucide-vue-next";
import {
  getPublicDir, listMediaPublic, saveFilesToMedia,
  deleteMedia as delMedia, renameMedia as rnMedia
} from "@/controllers/media.public.controller.js";

const publicDir = ref("");
const list = ref([]);
const selected = ref(null);
const dragover = ref(false);
const fileInput = ref(null);

const renaming = ref(false);
const renameTo = ref("");

// status messages (left pane)
const statusMsg = ref("");
const statusKind = ref("ok"); // 'ok' | 'err'
let statusTimer = null;
function flashStatus(msg, kind = "ok", ms = 1800) {
  statusMsg.value = msg;
  statusKind.value = kind;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (statusMsg.value = ""), ms);
}

// refresh icon spin
const spinning = ref(false);

// Filters (by kind)
const filters = [
  { key: "all", label: "すべて" },
  { key: "image", label: "画像" },
  { key: "video", label: "ビデオ" },
  { key: "audio", label: "オーディオ" },
];
const activeFilter = ref("all");

onMounted(async () => {
  publicDir.value = await getPublicDir();
  await refresh();
});

// Preview URL: dev -> "/media/...", prod -> file://
function toFileUrl(p) { return `file:///${p.replace(/\\/g, "/")}`; }
function mediaUrl(m) {
  if (typeof window !== "undefined" && window.location.protocol.startsWith("http")) {
    const rel = (m?.rel || "").replace(/\\/g, "/");
    return "/" + rel.replace(/^\/+/, "");
  }
  return toFileUrl(m.path);
}

function prettySize(n) {
  const u = ["B", "KB", "MB", "GB"]; let i = 0; let s = n;
  while (s > 1024 && i < u.length - 1) { s /= 1024; i++; }
  return `${s.toFixed(1)} ${u[i]}`;
}

async function copy(t) {
  try {
    await navigator.clipboard.writeText(t);
    flashStatus("リンクがコピーされました。", "ok");
  } catch (e) {
    flashStatus("エラー: クリップボードにコピーできませんでした。", "err");
  }
}

async function refresh() {
  const res = await listMediaPublic();
  list.value = res.items; // newest first
}

// ---- the ONLY filtered + watcher ----
const filtered = computed(() =>
  list.value.filter(i => (activeFilter.value === "all" ? true : i.kind === activeFilter.value))
);

watch(filtered, (arr) => {
  if (!arr.length) { selected.value = null; return; }
  if (!selected.value || !arr.some(i => i.path === selected.value.path)) {
    select(arr[0]); // auto-pick top-most
  }
}, { immediate: true });

function setFilter(key) { activeFilter.value = key; }
function select(m) { selected.value = m; renameTo.value = m?.name || ""; renaming.value = false; }

function pick() { fileInput.value?.click(); }
async function onChosen(e) { await doUpload(Array.from(e.target.files || [])); e.target.value = ""; }
async function onDrop(e) { dragover.value = false; await doUpload(Array.from(e.dataTransfer.files || [])); }
async function doUpload(files) { if (!files.length) return; await saveFilesToMedia(files); await refresh(); }


/* -------------------------------------------------------
thumbnail cache for videos
---------------------------------------------------------*/
const videoThumbs = ref({}); // { [absPath: string]: dataURL }

// Capture a small frame from a video as a PNG dataURL
async function captureVideoFrame(srcUrl) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous"; // safe in Electron + dev server
    video.src = srcUrl;

    const fail = () => reject(new Error("thumb-fail"));
    video.addEventListener("error", fail, { once: true });

    video.addEventListener("loadeddata", () => {
      // seek to a tiny offset to avoid black first frame
      let t = 0.1;
      try {
        if (Number.isFinite(video.duration) && video.duration > 0.2)
          t = Math.min(0.2, video.duration / 10);
      } catch {}
      const draw = () => {
        const vw = video.videoWidth || 320;
        const vh = video.videoHeight || 180;
        const maxW = 320;
        const r = Math.min(1, maxW / vw);
        const cw = Math.max(1, Math.floor(vw * r));
        const ch = Math.max(1, Math.floor(vh * r));
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, cw, ch);
        resolve(canvas.toDataURL("image/png"));
      };
      video.currentTime = t;
      video.addEventListener("seeked", draw, { once: true });
    }, { once: true });
  });
}

// Ensure we have a thumbnail for a given item
async function ensureVideoThumb(item) {
  if (videoThumbs.value[item.path]) return;
  try {
    const url = mediaUrl(item); // your existing function
    const dataUrl = await captureVideoFrame(url);
    videoThumbs.value = { ...videoThumbs.value, [item.path]: dataUrl };
  } catch {
    // If capture fails, the template falls back to the muted <video> preview
  }
}




async function onDelete(item) {
  if (!item) return;
  if (!confirm(`Delete "${item.name}"?`)) return;
  try {
    await delMedia(item.path);
    await refresh();        // watcher will auto-select next/top
    flashStatus("ファイルが削除されました。", "ok");
  } catch (e) {
    flashStatus(`エラー: ${e?.message || e}`, "err");
  }
}

async function onRename() {
  if (!selected.value) return;
  const newName = renameTo.value.trim();
  if (!newName) return;
  try {
    const src = selected.value.path;
    await rnMedia(src, newName);
    await refresh();
    const match = filtered.value.find(i => i.name === newName);
    if (match) select(match);
    else if (filtered.value.length) select(filtered.value[0]);
    else selected.value = null;
    renaming.value = false;
    flashStatus("ファイル名が変更されました。", "ok");
  } catch (e) {
    flashStatus(`エラー: ${e?.message || e}`, "err");
  }
}

async function onRefreshClick() {
  spinning.value = true;
  try {
    await window.api.invoke("app:reload"); // if handler exists, this reloads like View→Reload
    setTimeout(() => location.reload(), 50); // safety fallback if main doesn't reload
  } catch {
    location.reload();
  } finally {
    setTimeout(() => (spinning.value = false), 600);
  }
}
</script>
