// C:\comworks\esports-autocaster\src\controllers\media.public.controller.js
// src/controllers/media.public.controller.js
// IPC wrappers for the Public-folder media library.

export async function getPublicDir() {
  return await window.api.invoke("media.public.dir");
}

export async function listMediaPublic() {
  return await window.api.invoke("media.public.list");
}

/**
* Save an array of File objects to a category.
* @param {{category: 'overlays'|'video'|'audio'}} opts
* @param {File[]} files
 */
async function fileToBase64(file) {
  // Use FileReader -> data:URL and strip the "data:*;base64," prefix
  // Works reliably for large binary files (images, video, audio)
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result; // "data:<mime>;base64,<b64>"
      const comma = res.indexOf(",");
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
export async function saveFilesToCategory(opts, files) {
  const items = [];
  for (const f of files) {
    const b64 = await fileToBase64(f);
    items.push({
      name: f.name,
      dataBase64: b64,
      category: opts.category,
      // subcategory: opts.subcategory,
    });
  }
  return await window.api.invoke("media.public.save", items);
}

export async function deleteMedia(absPath) {
  return await window.api.invoke("media.public.delete", absPath);
}

export async function renameMedia(absPath, newName) {
  return await window.api.invoke("media.public.rename", { absPath, newName });
}
