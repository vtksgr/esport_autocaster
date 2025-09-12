# 🎮 Esport Autocaster

**Esport Autocaster** is a cross-platform desktop application built with **Electron + Vue 3 + OBS WebSocket** that automates streaming operations for esports and live events.  
It provides an intuitive UI to control OBS (Open Broadcaster Software) without manually handling scenes, sources, streaming, or recording setup.

---

## 🚀 Features

- Connects directly to OBS via **WebSocket**.
- Manage scenes, sources, and scene collections visually.
- Start/stop **streaming, recording, and virtual camera** with one click.
- RTMP(S) support for platforms like YouTube, Twitch, Facebook, or custom servers.
- Clean, modular architecture (Electron backend + Vue frontend).
- Real-time connection and status monitoring.

---

## 🏗️ Project Architecture

```
esport_autocaster-main/
│── electron/              # Electron backend (OBS services, IPC, main process)
│   ├── main.js            # Entry point for Electron
│   ├── preload.cjs        # Preload scripts for secure IPC
│   ├── config.json        # Default OBS connection config
│   ├── connection/        # Handles WebSocket connection setup
│   ├── ipc/               # IPC channels for renderer <-> main
│   └── services/          # OBS control services (stream, record, scenes, etc.)
│
│── src/                   # Vue 3 frontend (Vite powered)
│   ├── main.js            # Vue app entry point
│   ├── App.vue            # Root component
│   ├── controllers/       # Vue controllers wrapping Electron services
│   ├── ui/                # UI components for OBS control
│   ├── views/             # Page-level Vue views
│   └── router/            # Vue Router setup
│
│── public/                # Static assets
│── package.json           # Dependencies and scripts
│── vite.config.js         # Vite configuration
│── README.md              # Project documentation
```

---

## 🔄 Application Flow

### 1. Startup
- User launches **Esport Autocaster**.
- Electron starts and initializes `main.js`.
- OBS WebSocket client is configured using `config.json`.

### 2. Connection
- User enters OBS WebSocket credentials (host/port/password).
- `electron/services/obs.service.js` manages the connection lifecycle.
- Vue frontend (`src/controllers/obs.connect.status.js`) reflects connection status in UI.

### 3. Scene & Source Management
- OBS scene collections are fetched from OBS (`obs.scene.controller.js`).
- `ObsSceneCollection.vue` displays collections, while `ObsSceneList.vue` and `ObsSourceList.vue` show individual scenes and sources.

### 4. Stream / Record / VirtualCam
- User interacts with UI components:
  - `ObsStreamController.vue` → `obs.stream.controller.js` → `electron/services/obs.stream.service.js`.
  - `ObsRecordController.vue` → `obs.record.controller.js` → `electron/services/obs.record.service.js`.
  - `ObsProgramDisplay.vue` & `obs.virtualcam.controller.js` for **virtual camera**.
- Electron sends commands to OBS via WebSocket.
- Status updates flow back to Vue for real-time display.

### 5. RTMP(S) Integration
- Users select **YouTube / Twitch / Facebook / Custom**.
- Predefined RTMP URLs are auto-filled.
- Stream key is provided by user → stored securely → applied to OBS settings.

---

## ⚡ Tech Stack

- **Frontend:** Vue 3, Vite, TailwindCSS
- **Backend:** Electron
- **Integration:** OBS WebSocket API
- **Languages:** JavaScript (ESM/CJS mix)

---

## 📝 Scripts

```bash
# Run development (Electron + Vite concurrently)
npm run dev

# Build production app
npm run build
```

---

## 📌 Future Roadmap

- Multi-platform stream key management.
- Advanced OBS automation (dynamic overlays, scoreboards).
- Cloud sync of configs.
- Multi-camera live production features.

---
