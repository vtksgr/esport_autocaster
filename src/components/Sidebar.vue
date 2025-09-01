<!-- src/components/Sidebar.vue -->
<template>
  <aside class="h-screen w-56 bg-[#232436] text-gray-300 flex flex-col justify-between">
    <!-- Top / Logo -->
    <div>
      <div class="text-center text-blue-400 font-bold text-lg py-6">ESPORT AUTOCASTER</div>

      <!-- Menu -->
      <nav class="flex flex-col space-y-1 px-2">
        <RouterLink
          v-for="item in menuItems"
          :key="item.name"
          :to="item.to"
          class="flex items-center gap-2 px-3 py-2 rounded transition"
          :class="route.name === item.name ? 'bg-[#15161A] text-white' : 'hover:bg-gray-700'"
        >
          <component :is="item.icon" class="w-4 h-4 shrink-0" />
          <span class="text-sm">{{ item.label }}</span>
        </RouterLink>
      </nav>
    </div>

    <!-- Footer -->
    <footer class="text-center text-xs text-gray-500 py-3">v1.0 ©2025</footer>
  </aside>
</template>

<script setup>
import { useRoute } from 'vue-router';
import {
  LayoutGrid,      // ダッシュボード
  Gamepad2,        // ゲーム連携
  Layers,          // オーバーレイ
  MonitorPlay,     // シーン管理
  Settings,        // 配信設定
  FileText,        // ログ
  HelpCircle       // ヘルプ
} from 'lucide-vue-next';

const route = useRoute();

/**
 * Menu items mapped to your router:
 * - ダッシュボード  -> name: 'dashboard'      path: '/'
 * - ゲーム連携      -> name: 'game'           path: '/connect_game'
 * - オーバーレイ    -> name: 'overlay'        path: '/overlay'
 * - シーン管理      -> name: 'scene'          path: '/scene'
 * - 配信設定        -> name: 'settings'       path: '/stream_settings'
 * - ログ            -> name: 'logs'           path: '/logs'
 * - ヘルプ          -> name: 'help'           path: '/help'
 */
const menuItems = [
  { name: 'dashboard', label: 'ダッシュボード',  to: '/',               icon: LayoutGrid },
  { name: 'game',      label: 'ゲーム連携',      to: '/connect_game',   icon: Gamepad2 },
  { name: 'overlay',   label: 'オーバーレイ',    to: '/overlay',        icon: Layers },
  { name: 'scene',     label: 'シーン管理',      to: '/scene',          icon: MonitorPlay },
  { name: 'settings',  label: '配信設定',        to: '/stream_settings',icon: Settings },
  { name: 'logs',      label: 'ログ',            to: '/logs',           icon: FileText },
  { name: 'help',      label: 'ヘルプ',          to: '/help',           icon: HelpCircle },
];
</script>

<style scoped>
a { transition: all 0.18s ease-in-out; }
</style>
