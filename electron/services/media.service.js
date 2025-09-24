// electron/services/media.service.js
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { app } from "electron";

/* -----------------------
   Path helpers (Public/)
------------------------ */
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function getProjectRoot() {
  // dev: <root>/electron exists one level up
  const appPath = app.getAppPath();
  const parent = path.dirname(appPath);
  try { if (fs.existsSync(path.join(parent, "electron"))) return parent; } catch {}
  return appPath; // prod (resources/app)
}

export function getPublicDir() {
  const root = getProjectRoot();
  const pub = path.join(root, "public");
  ensureDir(pub);
  return pub;
}

/* -----------------------
   Category structure
------------------------ */
const CATEGORY_DIRS = {
  overlays: { base: "overlays" }, // flattened
  video: { base: "video" },
  audio: { base: "audio" },
};
export function ensureMediaTree() {
  const base = getPublicDir();
  ensureDir(base);
  // overlays root only (no subs)
  ensureDir(path.join(base, CATEGORY_DIRS.overlays.base));
  // video & audio
  ensureDir(path.join(base, CATEGORY_DIRS.video.base));
  ensureDir(path.join(base, CATEGORY_DIRS.audio.base));
  return base;
}

/* -----------------------
   Type helpers
------------------------ */
const EXT = {
  image: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"],
  video: [".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"],
  audio: [".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a"],
};
function kindFromExt(ext) {
  const e = (ext || "").toLowerCase();
  if (EXT.image.includes(e)) return "image";
  if (EXT.video.includes(e)) return "video";
  if (EXT.audio.includes(e)) return "audio";
  return "file";
}
function sanitizeName(name) { return name.replace(/[\\/:*?"<>|]/g, "_").trim(); }
function safeRandomName(orig) {
  const ext = path.extname(orig || "").toLowerCase();
  const base = crypto.randomUUID().replace(/-/g, "");
  return `${base}${ext || ""}`;
}

/* -------------------------------------
   Public, category-aware core methods
-------------------------------------- */
export function listAllMedia() {
  const base = ensureMediaTree();
  const items = [];

  // overlays: include ALL files under overlays (recursively), surface as one category
  const overlaysRoot = path.join(base, "overlays");
  (function walk(dir, relFromRoot = "") {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, ent.name);
      const rel = path.join("overlays", relFromRoot, ent.name).replace(/\\/g, "/");
      if (ent.isDirectory()) {
        walk(fp, path.join(relFromRoot, ent.name));
        continue;
      }
      if (!ent.isFile()) continue;
      const st = fs.statSync(fp);
      const ext = path.extname(ent.name);
      items.push({
        name: ent.name,
        path: fp,
        rel,
        size: st.size,
        ext,
        kind: kindFromExt(ext),
        category: "overlays",
        subcategory: null, // flattened
        mtimeMs: st.mtimeMs,
      });
    }
  })(overlaysRoot, "");

  // video & audio
  for (const cat of ["video", "audio"]) {
    const dir = path.join(base, CATEGORY_DIRS[cat].base);
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!ent.isFile()) continue;
      const fp = path.join(dir, ent.name);
      const st = fs.statSync(fp);
      const ext = path.extname(ent.name);
      items.push({
        name: ent.name,
        path: fp,
        rel: path.join(cat, ent.name).replace(/\\/g, "/"),
        size: st.size,
        ext,
        kind: kindFromExt(ext),
        category: cat,
        subcategory: null,
        mtimeMs: st.mtimeMs,
      });
    }
  }

  items.sort((a, b) => (b.mtimeMs ?? 0) - (a.mtimeMs ?? 0) || a.name.localeCompare(b.name));
  items.forEach(i => delete i.mtimeMs);
  return { baseDir: base, items };
}

/**
+ * payload: Array<{ name, dataBase64, category: 'overlays'|'video'|'audio' }>
 */
export function saveToCategory(payload = []) {
  const base = ensureMediaTree();
  const saved = [];

  for (const item of payload) {
    const fileName = sanitizeName(item.name || "upload.bin");
    let destDir;
    if (item.category === "overlays") {
destDir = path.join(base, "overlays");
    } else if (item.category === "video") {
      destDir = path.join(base, "video");
    } else if (item.category === "audio") {
      destDir = path.join(base, "audio");
    } else {
      destDir = base;
    }
    ensureDir(destDir);

    const dest = path.join(destDir, fileName);
    const buf = Buffer.from(item.dataBase64, "base64");
    fs.writeFileSync(dest, buf);
    const ext = path.extname(fileName);

    saved.push({
      name: fileName,
      path: dest,
      rel: path.relative(base, dest).replace(/\\/g, "/"),
      size: buf.length,
      ext,
      kind: kindFromExt(ext),
      category: item.category,
      subcategory: null,

    });
  }
  return { baseDir: base, saved };
}

export function deleteMedia(absPath) {
  const base = ensureMediaTree();
  const rel = path.relative(base, absPath);
  if (rel.startsWith("..")) throw new Error("Refusing to delete outside Public folder.");
  if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
  return { ok: true };
}

export function renameMedia(absPath, newName) {
  const base = ensureMediaTree();
  const safe = sanitizeName(newName);
  const dir = path.dirname(absPath);
  const dest = path.join(dir, safe);
  const relSrc = path.relative(base, absPath);
  const relDst = path.relative(base, dest);
  if (relSrc.startsWith("..") || relDst.startsWith(".."))
    throw new Error("Refusing to rename outside Public folder.");
  fs.renameSync(absPath, dest);
  const ext = path.extname(safe);
  return {
    name: safe,
    path: dest,
    rel: path.relative(base, dest).replace(/\\/g, "/"),
    ext,
    kind: kindFromExt(ext),
  };
}

/* ----------------------------------------------------
   Legacy-compatible wrappers (keep old IPC working)
   - These now point to Public/ and return similar shapes
----------------------------------------------------- */
export function legacy_getPreferredUploadsDir() {
  // Preserve signature & keys
  return { dir: getPublicDir(), location: "public" };
}
export function legacy_listMedia() {
  const { items } = listAllMedia();
  // Flatten to match old listMedia() shape: { dir, files: [...] }
  return {
    dir: getPublicDir(),
    files: items.map(i => ({
      name: i.name,
      path: i.path,
      kind: i.kind,
      size: i.size,
      ext: i.ext,
    })),
  };
}
/** payload: [{name, dataBase64, mime}] */
export function legacy_saveFiles(payload = []) {
  // Save into Public root (no categories) for full backward compatibility.

  const items = payload.map(p => ({
    name: p.name,
    dataBase64: p.dataBase64,
    category: "overlays",
  }));
  return saveToCategory(items);
}
