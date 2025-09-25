<template>
  <button
    :title="title"
    :aria-label="title"
    class="inline-flex items-center justify-center p-2 rounded border border-slate-600 bg-slate-800 hover:bg-slate-900 disabled:opacity-50"
    :class="btnClass"
    :disabled="disabled"
    @click="handleClick"
  >
    <RefreshCw
      :style="{ width: iconPx + 'px', height: iconPx + 'px' }"
      :class="spinning ? 'animate-spin' : ''"
    />
  </button>
</template>

<script setup>
import { ref, computed } from 'vue'
import { RefreshCw } from 'lucide-vue-next'

const props = defineProps({
  title: { type: String, default: 'Reload' },
  // Tailwind utility classes to customize the button if needed
  btnClass: { type: String, default: '' },
  // 16, 20, 24 etc.
  iconSize: { type: Number, default: 16 },
  // disable the button externally if needed
  disabled: { type: Boolean, default: false },
  // how long to keep spin if the page doesn't reload immediately
  spinDurationMs: { type: Number, default: 600 }
})

const iconPx = computed(() => props.iconSize)
const spinning = ref(false)

async function handleClick () {
  if (props.disabled) return
  spinning.value = true

  try {
    // prefer Electron main-process reload
    if (window?.api?.invoke) {
      await window.api.invoke('app:reload')
      // if main didn't reload (edge), force a fallback
      setTimeout(() => location.reload(), 50)
    } else {
      location.reload()
    }
  } catch {
    // IPC not registered or failed — fallback
    location.reload()
  } finally {
    // Usually the page reloads; this is just a safety timeout
    setTimeout(() => { spinning.value = false }, props.spinDurationMs)
  }
}
</script>
