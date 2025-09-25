// C:\comworks\esports-autocaster\src\controllers\media.public.controller.js


export async function getPublicDir() {
  return await window.api.invoke("media.public.dir");
}

export async function listMediaPublic() {
  return await window.api.invoke("media.public.list");
}

export async function listMediaFlat() {
  return await window.api.invoke("media.public.list");
}

async function fileToBase64(file) {
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

export async function saveFilesToMedia(files) {
  const items = [];
  for (const f of files) items.push({ name: f.name, dataBase64: await fileToBase64(f) });
  return await window.api.invoke("media.public.save", items);
}

export async function deleteMedia(absPath) {
  return await window.api.invoke("media.public.delete", absPath);
}

export async function renameMedia(absPath, newName) {
  return await window.api.invoke("media.public.rename", { absPath, newName });
}
