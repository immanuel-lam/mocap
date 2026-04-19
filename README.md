# MoCap — iPhone 6DoF Motion Capture

Turn your iPhone into a motion capture device. Stream live 6DoF pose + 100 Hz IMU to a 3D viewer, record full sessions, and export keyframed camera rigs to Blender.

```
iPhone (ARKit + IMU) ──WS──▶ Node relay server ──WS──▶ React/Three.js viewer
                    └──HTTP upload on stop──▶ session stored ──▶ Blender exporter
```

---

## Quick start

**Requirements:** Node 18+, pnpm, Xcode 15+, physical iPhone (ARKit doesn't run in Simulator)

```bash
# 1 — install dependencies
pnpm install

# 2 — start server + viewer
pnpm dev
# Server: http://localhost:3000   Viewer: http://localhost:5173
# Your Mac's LAN IP is printed on startup — note it down for the iOS app
```

**iOS app:**

1. Open `ios/MocapCapture.xcodeproj` in Xcode
2. Select your device, hit **Cmd+R**
3. Go to **Settings** tab → enter `http://[mac-ip]:3000`
4. Point camera at a textured surface (good lighting = better tracking)
5. Hit the record button — viewer shows live tilt immediately

---

## Monorepo layout

```
mocap/
├── ios/                    Swift iOS app (ARKit + CoreMotion)
│   └── MocapCapture/
│       ├── Capture/        ARSessionManager, SensorManager
│       ├── Recording/      SessionRecorder, SessionEncoder, SessionStore
│       ├── Transport/      WebSocketClient, Discovery (Bonjour), Uploader
│       ├── Models/         Session, Messages (Codable structs)
│       └── Views/          CaptureView, SettingsView, SessionListView
│
├── server/                 Node.js relay + REST API
│   └── src/
│       ├── index.ts        Entry point, Bonjour, QR code
│       ├── ws.ts           WebSocket fan-out (capture → viewer)
│       ├── http.ts         Session upload/list/delete endpoints
│       └── storage.ts      Session storage on disk
│
├── viewer/                 React + Three.js viewer
│   └── src/
│       ├── App.tsx         Top bar, mode tabs, SIM button
│       ├── modes/          LiveMode, ReplayMode
│       ├── scene/          Phone mesh, Trail, WorldGrid
│       ├── hooks/          useLiveSocket, useReplay
│       ├── state/          Zustand store (session, live, replay)
│       └── ui/             SessionPicker, Timeline, CameraFollowToggle
│
├── exporters/blender/      TypeScript → Blender Python exporter
│   └── generate.ts
│
└── shared/schema/          JSON schema + fixtures (source of truth)
```

---

## Viewer

Open `http://localhost:5173` in your browser.

| Control | Action |
|---|---|
| **Live tab** | Shows live feed from iOS app |
| **Replay tab** | Select a session from the sidebar, scrub the timeline |
| **SIM button** | Spins the model locally — tests the viewer without a phone |
| **Clear button** | Delete all stored sessions |
| **✕ on session row** | Delete individual session |
| Orbit drag | Rotate the 3D view |
| Scroll | Zoom |

The RGB arrows on the phone model show orientation axes: **Red = X**, **Green = Y**, **Blue = Z (screen normal)**.

---

## Blender export

```bash
# Export phone rig only
npx tsx exporters/blender/generate.ts sessions/<id>/session.json --fps 30 --out rig.py

# Export phone rig + camera (recommended)
npx tsx exporters/blender/generate.ts sessions/<id>/session.json --fps 30 --camera --out rig.py
```

Then in Blender: **Scripting** tab → **Open** → select `rig.py` → **Run Script**.

This creates:
- `phone_rig` — plain axes object with full 6DoF keyframes
- `mocap_camera` *(with `--camera`)* — camera parented to the rig, set as active render camera, 26 mm lens (iPhone main wide equivalent), render resolution matched to your device

Portrait orientation is pre-baked into the keyframes — no manual corrections needed in Blender.

### Coordinate systems

| Space | Convention |
|---|---|
| ARKit / Three.js | Right-handed, Y-up, −Z forward |
| Blender | Right-handed, Z-up, Y-forward |
| Conversion | `pos: (x,y,z) → (x,−z,y)`  `rot: −90° around X` |

Conversion happens **only** inside `exporters/blender/generate.ts`. Nowhere else.

---

## iOS app overview

- **ARKit** (`ARWorldTrackingConfiguration`) — 6DoF pose at camera frame rate (~60 Hz). No plane detection, no scene reconstruction (saves battery).
- **CoreMotion** (`CMMotionManager`) — accelerometer, gyroscope, device attitude at 100 Hz. No permission dialog; iOS grants silently.
- **WebSocket** (`URLSessionWebSocketTask`) — streams 16 ms batches to the relay server while recording. Identifies after handshake completes.
- **Upload** — multipart POST on recording stop; session JSON + optional video.
- **Bonjour** — server publishes `_mocap._tcp` with its LAN IP in the TXT record. iOS discovers and auto-fills the server URL in Settings.

---

## Server API

| Method | Path | Description |
|---|---|---|
| `GET` | `/sessions` | List session IDs |
| `GET` | `/sessions/:id` | Download session JSON |
| `GET` | `/sessions/:id/video` | Stream video (if recorded) |
| `POST` | `/sessions` | Upload session (multipart: `session` + optional `video`) |
| `DELETE` | `/sessions/:id` | Delete one session |
| `DELETE` | `/sessions` | Delete all sessions |
| `GET` | `/debug/ws` | List connected WebSocket clients |

---

## Development

```bash
pnpm dev          # server (port 3000) + viewer (port 5173) in watch mode
pnpm typecheck    # TypeScript strict check across all packages

# iOS — build check (requires Xcode command-line tools)
cd ios && xcodebuild -scheme MocapCapture -destination 'generic/platform=iOS' build

# After adding new Swift files, regenerate the Xcode project
cd ios && xcodegen generate
```

---

## Notes

- ARKit needs **good lighting and a textured surface** (not a plain white wall). The tracking label in the iOS app shows `Normal` / `Limited` / `Not Available`.
- The on-device recording is the source of truth. WebSocket is a preview feed only — dropped packets don't affect the saved session.
- Don't stream video over WebSocket. Video is written to disk and uploaded as a file on stop.
- Timestamps are **not** guaranteed monotonic or evenly spaced. The viewer interpolates; the Blender exporter decimates to target fps.
