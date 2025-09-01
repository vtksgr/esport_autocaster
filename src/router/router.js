import { createRouter, createWebHashHistory } from "vue-router";
import Dashboard from "@/views/Dashboard.vue";
import ConnectGames from "@/views/ConnectGames.vue";
import Overlay from "@/views/Overlay.vue";
import SceneControl from "@/views/SceneControl.vue";
import Log from "@/views/Log.vue";
import StreamSetting from "@/views/StreamSetting.vue";
import Help from "@/views/Help.vue";

const routes = [
  { path: "/", name: "dashboard", component: Dashboard },
  { path: "/connect_game", name: "game", component: ConnectGames },
  { path: "/overlay", name: "overlay", component: Overlay },
  { path: "/scene", name: "scene", component: SceneControl },
  { path: "/stream_settings", name: "settings", component: StreamSetting },
  { path: "/logs", name: "logs", component: Log },
  { path: "/help", name: "help", component: Help },
];

export default createRouter({
  history: createWebHashHistory(), // hash is safer in Electron
  routes,
});
