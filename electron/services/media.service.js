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
   Single media folder
------------------------ */
const MEDIA_DIR = "media";

export function ensureMediaTree() {
  const base = getPublicDir();
  ensureDir(base);
  ensureDir(path.join(base, MEDIA_DIR)); // ONLY /public/media
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
function uniquePath(dir, name) {
  // avoid overwriting: file.ext, file (1).ext, file (2).ext ...
  const base = path.parse(name).name;
  const ext = path.parse(name).ext;
  let attempt = path.join(dir, name);
  let i = 1;
  while (fs.existsSync(attempt)) {
    attempt = path.join(dir, `${base} (${i++})${ext}`);
  }
  return attempt;
}

/* -------------------------------------
   Core methods (flat /public/media)
-------------------------------------- */
export function listAllMedia() {
  const base = ensureMediaTree();
  const dir = path.join(base, MEDIA_DIR);
  ensureDir(dir);

  const items = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isFile()) continue;
    const fp = path.join(dir, ent.name);
    const st = fs.statSync(fp);
    const ext = path.extname(ent.name);
    items.push({
      name: ent.name,
      path: fp,
      rel: path.join(MEDIA_DIR, ent.name).replace(/\\/g, "/"),
      size: st.size,
      ext,
      kind: kindFromExt(ext),   // "image" | "video" | "audio" | "file"
      category: "media",
      subcategory: null,
      mtimeMs: st.mtimeMs,
    });
  }

  items.sort((a, b) => (b.mtimeMs ?? 0) - (a.mtimeMs ?? 0) || a.name.localeCompare(b.name));
  items.forEach(i => delete i.mtimeMs);
  return { baseDir: base, items };
}

/** payload: Array<{ name, dataBase64 }> */
export function saveToCategory(payload = []) {
  const base = ensureMediaTree();
  const dir = path.join(base, MEDIA_DIR);
  ensureDir(dir);

  const saved = [];
  for (const item of payload) {
    const safeName = sanitizeName(item.name || "upload.bin");
    const dest = uniquePath(dir, safeName);
    const buf = Buffer.from(item.dataBase64, "base64");
    fs.writeFileSync(dest, buf);

    const ext = path.extname(dest);
    saved.push({
      name: path.basename(dest),
      path: dest,
      rel: path.relative(base, dest).replace(/\\/g, "/"),
      size: buf.length,
      ext,
      kind: kindFromExt(ext),
      category: "media",
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
  const dir = path.dirname(absPath);
  const safe = sanitizeName(newName);
  // keep original if same name; otherwise avoid collisions
  const target = path.join(dir, safe);
  const dest = fs.existsSync(target) ? uniquePath(dir, safe) : target;

  const relSrc = path.relative(base, absPath);
  const relDst = path.relative(base, dest);
  if (relSrc.startsWith("..") || relDst.startsWith(".."))
    throw new Error("Refusing to rename outside Public folder.");

  fs.renameSync(absPath, dest);
  const ext = path.extname(dest);
  return {
    name: path.basename(dest),
    path: dest,
    rel: path.relative(base, dest).replace(/\\/g, "/"),
    ext,
    kind: kindFromExt(ext),
  };
}

/* ----------------------------------------------------
   Legacy-compatible wrappers (keep old IPC working)
----------------------------------------------------- */
export function legacy_getPreferredUploadsDir() {
  // Keep the return shape compatible
  return { dir: getPublicDir(), location: "public" };
}
export function legacy_listMedia() {
  const { items } = listAllMedia();
  return {
    dir: path.join(getPublicDir(), MEDIA_DIR),
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
  const items = payload.map(p => ({
    name: p.name,
    dataBase64: p.dataBase64,
  }));
  return saveToCategory(items);
}
