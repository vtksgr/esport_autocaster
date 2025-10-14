<!-- C:\comworks\esports-autocaster\src\views\CreateStreamProfile.vue -->
<template>
  <div class="flex gap-6 items-start justify-start">
    <!-- Cards -->
    <div
      v-for="card in cards"
      :key="card.name"
      class="w-[220px] h-[128px] rounded p-3 flex flex-col justify-between transition border"
      :class="[ card.active ? 'border-green-500' : 'border-white/10', 'bg-[#2b3441]']"
    >
      <div>
        <div class="flex justify-between items-center">
          <span class="text-sm text-white/90 font-semibold tracking-wide">{{ card.name }}</span>
          <span
            class="text-[10px] px-1.5 py-0.5 rounded"
            :class="card.active ? 'bg-green-600/30 text-green-300' : (card.exists ? 'bg-white/10 text-white/70' : 'bg-yellow-500/20 text-yellow-200')"
          >
            {{ card.active ? 'Active' : (card.exists ? 'Exists' : 'Not Created') }}
          </span>
        </div>
        <div class="h-px bg-white/15 my-2"></div>
      </div>

      <div class="flex gap-2">
        <!-- Create -->
        <button
          class="flex-1 text-sm font-medium rounded py-1.5 transition"
          :class="[
            card.exists || busy
              ? 'bg-white/10 text-white/40 cursor-not-allowed'
              : 'bg-white/20 hover:bg-white/30 text-white/90',
          ]"
          :disabled="card.exists || busy"
          @click="onCreateClick(card)"
        >
          create
        </button>

        <!-- Select -->
        <button
          class="flex-1 text-sm font-medium rounded py-1.5 transition"
          :class="[
            (!card.exists || card.active || busy)
              ? 'bg-white/10 text-white/40 cursor-not-allowed'
              : 'bg-white/20 hover:bg-white/30 text-white/90',
          ]"
          :disabled="!card.exists || card.active || busy"
          @click="onSelectClick(card)"
        >
          select
        </button>
      </div>
    </div>

    <!-- Add-new empty card (optional visual only) -->
    <div
      class="w-[220px] h-[128px] bg-[#2b3441] rounded border border-white/10 flex items-center justify-center hover:bg-white/5 cursor-default transition"
      title="Add new profile (coming soon)"
    >
      <span class="text-2xl text-white/70">+</span>
    </div>
  </div>

  <!-- Prompt Modal -->
  <div
    v-if="modal.open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    @keydown.esc="closeModal"
  >
    <div class="w-full max-w-md rounded-2xl bg-[#222a35] border border-white/10 p-5 shadow-xl">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-white/90 font-semibold">
          {{ modal.title }}
        </h3>
        <button class="text-white/50 hover:text-white/80" @click="closeModal">✕</button>
      </div>
      <p class="text-white/80 text-sm leading-relaxed mb-5">
        {{ modal.message }}
      </p>

      <div class="flex justify-end gap-2">
        <button
          v-if="modal.showCancel"
          class="px-3 py-1.5 text-sm rounded bg-white/10 hover:bg-white/15 text-white/80"
          @click="closeModal"
        >
          Cancel
        </button>
        <button
          v-if="modal.showConfirm"
          class="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          :disabled="busy"
          @click="onConfirm"
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import {
  listProfiles,
  createProfile as createProfileApi,
  selectProfile as selectProfileApi,
  getCurrentSelection,
  ensureDefaults,
  getObsStatus, // added in controller in our previous patch
} from "@/controllers/obs.profile.controller.js";

/* ---------------------------- State & utilities --------------------------- */
const busy = ref(false);
const cards = ref([
  { name: "SK1", exists: false, active: false },
  { name: "SK2", exists: false, active: false },
  { name: "SK3", exists: false, active: false },
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s ?? "").trim().toLowerCase();

const lastExisting = ref(new Set());

/* ------------------------------- Modal state ------------------------------ */
const modal = ref({
  open: false,
  type: "",            // 'create-exists' | 'create-confirm' | 'select-confirm'
  name: "",
  title: "",
  message: "",
  showConfirm: false,
  showCancel: true,
  payload: null,       // optional payload
});

function openModal(opts) {
  modal.value = { open: true, showCancel: true, showConfirm: false, type: "", name: "", title: "", message: "", payload: null, ...opts };
}
function closeModal() {
  modal.value.open = false;
  modal.value.type = "";
  modal.value.name = "";
  modal.value.payload = null;
}

/* ------------------------------- Refresh UI ------------------------------ */
async function refreshState() {
  try {
    busy.value = true;
    const [{ connected }, existingRaw, current] = await Promise.all([
      getObsStatus().catch(() => ({ connected: false })),
      listProfiles().catch(() => []),
      getCurrentSelection().catch(() => ({})),
    ]);

    const currentName = current?.sceneCollection ?? "";
    const existing =
      connected && Array.isArray(existingRaw) && existingRaw.length
        ? new Set(existingRaw.map(norm))
        : lastExisting.value; // keep prior truth if OBS blips

    if (currentName) existing.add(norm(currentName)); // current always exists

    lastExisting.value = new Set(existing);

    cards.value.forEach((c) => {
      c.exists = existing.has(norm(c.name));
      c.active = norm(c.name) === norm(currentName);
    });
  } catch (err) {
    console.error("[StreamProfileGrid] refresh error:", err);
    // preserve last known existence/active on error
    const current = await getCurrentSelection().catch(() => ({}));
    const currentName = current?.sceneCollection ?? "";
    cards.value.forEach((c) => {
      c.exists = lastExisting.value.has(norm(c.name)) || norm(c.name) === norm(currentName);
      c.active = norm(c.name) === norm(currentName);
    });
  } finally {
    busy.value = false;
  }
}

/* ------------------------------- Button flows ---------------------------- */
// CLICK: CREATE (per-card)
function onCreateClick(card) {
  if (busy.value) return;

  if (card.exists) {
    // case: already exists -> info prompt with only Cancel
    openModal({
      type: "create-exists",
      name: card.name,
      title: "Scene collection already exists",
      message: `“${card.name}” is already created in OBS.`,
      showConfirm: false,
      showCancel: true,
    });
    return;
  }

  // case: does not exist -> confirm to create
  openModal({
    type: "create-confirm",
    name: card.name,
    title: "Create scene collection?",
    message: `Do you want to create the scene collection “${card.name}”?`,
    showConfirm: true,
    showCancel: true,
  });
}

// CONFIRM handler for modal
async function onConfirm() {
  const m = modal.value;
  if (!m.open) return;

  switch (m.type) {
    case "create-confirm":
      await handleConfirmCreate(m.name);
      break;
    case "select-confirm":
      await handleConfirmSelect(m.name);
      break;
    default:
      break;
  }
}

// Actual creation
async function handleConfirmCreate(name) {
  busy.value = true;
  try {
    await createProfileApi(name); // backend is idempotent
    // optimistic local flip
    cards.value.forEach((c) => { if (c.name === name) { c.exists = true; c.active = true; } });

    try { await ensureDefaults(name); } catch (e) {
      console.warn("[ensure-defaults] non-fatal:", e?.message || e);
    }
    await sleep(200);
  } catch (e) {
    console.error("[Create] error:", e);
  } finally {
    closeModal();
    await refreshState(); // always re-evaluate exists/active
  }
}

// CLICK: SELECT (per-card)
function onSelectClick(card) {
  if (busy.value || !card.exists || card.active) return;

  openModal({
    type: "select-confirm",
    name: card.name,
    title: "Switch active scene collection?",
    message: `Set “${card.name}” as the current scene collection in OBS?`,
    showConfirm: true,
    showCancel: true,
  });
}

// Actual selection
async function handleConfirmSelect(name) {
  busy.value = true;
  try {
    await selectProfileApi(name);
    // optimistic local flip
    cards.value.forEach((c) => (c.active = c.name === name));
    await sleep(150);
  } catch (e) {
    console.error("[Select] error:", e);
  } finally {
    closeModal();
    await refreshState();
  }
}

onMounted(refreshState);
</script>
