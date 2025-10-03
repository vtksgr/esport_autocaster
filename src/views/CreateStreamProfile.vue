<script setup>
import { ref, onMounted } from "vue";

const cards = ref([
  { key: "SK1", created: false, busy: false },
  { key: "SK2", created: false, busy: false },
  { key: "SK3", created: false, busy: false },
]);

const current = ref({sceneCollection: null, scenes: [],audio: []});

async function refreshExisting() {
  const res = await window.api.invoke("obs:profile:list");
  if (!res?.ok) {
    console.warn("obs:profile:list error:", res?.error);
    return;
  }
  const existing = new Set(res.data || []);
  cards.value.forEach(c => { c.created = existing.has(c.key); });
}
onMounted(refreshExisting);

async function createProfile(key) {
  const card = cards.value.find(c => c.key === key);
  if (!card || card.busy) return;
  card.busy = true;

  const res = await window.api.invoke("obs:profile:create", { profileName: key });
  card.busy = false;

  if (!res?.ok) {
    alert(`Create failed: ${res?.error}`);
    return;
  }
  card.created = true;
}

async function selectProfile(key) {
  const card = cards.value.find(c => c.key === key);
  if (!card) return;
  card.busy = true;

  const res = await window.api.invoke("obs:profile:select", { profileName: key });
  card.busy = false;

  if (!res?.ok) {
    alert(`Select failed: ${res?.error}`);
    return;
  }
  current.value = res.data; // { sceneCollection, scenes[], audio[] }
}

</script>

<template>
  <div class="grid grid-cols-4 gap-4">
    <div v-for="c in cards" :key="c.key" class="rounded-xl bg-slate-800 p-4 text-slate-100">
      <div class="text-sm opacity-80">{{ c.key }}</div>
      <div class="mt-3 flex gap-2">
        <button v-if="!c.created"
                class="px-3 py-1 rounded bg-indigo-500 disabled:opacity-50"
                :disabled="c.busy"
                @click="createProfile(c.key)">
          {{ c.busy ? '...' : 'Create' }}
        </button>
        <button class="px-3 py-1 rounded bg-slate-600 disabled:opacity-50"
                :disabled="!c.created || c.busy" @click="selectProfile(c.key)">
          Select
        </button>
      </div>
    </div>
  </div>

  <!-- Preview/Inspector area -->
  <div class="mt-6 rounded-xl bg-slate-900 p-4 text-slate-100">
    <div class="text-sm opacity-80">Scene Collection: {{ current.sceneCollection || '—' }}</div>
    <div class="grid grid-cols-3 gap-4 mt-4">
      <div class="rounded bg-slate-800 p-3">
        <div class="font-semibold mb-2">Scenes</div>
        <ul class="space-y-1 text-sm">
          <li v-for="s in current.scenes" :key="s.sceneName">{{ s.sceneName }}</li>
        </ul>
      </div>
      <div class="rounded bg-slate-800 p-3">
        <div class="font-semibold mb-2">Sources (by scene)</div>
        <div v-for="s in current.scenes" :key="s.sceneName" class="mb-3">
          <div class="text-xs opacity-70 mb-1">{{ s.sceneName }}</div>
          <ul class="text-xs ml-2 list-disc">
            <li v-for="i in s.inputs" :key="i.sceneItemId">{{ i.sourceName }} <span class="opacity-60">({{ i.inputKind || 'input' }})</span></li>
          </ul>
        </div>
      </div>
      <div class="rounded bg-slate-800 p-3">
        <div class="font-semibold mb-2">Audio Inputs</div>
        <ul class="space-y-1 text-sm">
          <li v-for="a in current.audio" :key="a.inputName">{{ a.inputName }} <span class="opacity-60">({{ a.inputKind }})</span></li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* match your dark UI */
</style>
