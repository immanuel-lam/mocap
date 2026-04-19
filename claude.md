# Phone Motion Capture (Native) — Project context

## What this is
iOS app (Swift / SwiftUI / ARKit) captures 6DoF pose, 100 Hz IMU, and touch
events. Streams live to a Node server, uploads full session on stop. React +
Three.js viewer renders live and replay. Blender export produces a keyframed
rig with correct coordinate conversion.

## Model preference
Use Opus for: ARKit integration, quaternion / coordinate-system math, Blender
export, Three.js scene work. Sonnet is fine for SwiftUI layout, Express
routes, and config.

## Coordinate systems
- Store everything in ARKit's native frame (right-handed, Y-up, -Z forward,
  meters).
- Three.js uses the same convention — pass through without conversion.
- Blender uses Z-up. Convert once, inside exporters/blender/generate.ts, and
  nowhere else. The conversion is `(x, y, z) -> (x, -z, y)` for position and
  a corresponding -90° rotation around X for orientation.
- Blender quaternions are (w, x, y, z). The JSON uses (x, y, z, w). Wrap this
  in a helper named `quatJsonToBlender` and use it everywhere in the exporter.

## Conventions
- Swift 5.9, iOS 17 minimum, SwiftUI + Combine or async/await (not both in
  one file).
- TypeScript strict mode everywhere in server/viewer/exporters.
- pnpm workspace protocol for internal TS deps.
- Session schema: shared/schema/session.schema.json is the source of truth.
  Swift Codable structs and TS interfaces must match. Fixtures validate both.
- No UI component libraries in the viewer. Tailwind only.
- State in viewer: Zustand. Nothing else.
- iOS: no third-party packages unless explicitly approved. URLSessionWebSocketTask
  is fine, don't add Starscream.

## Current status
Phases 0–6 complete. All phases implemented and verified:
- Phase 0: Scaffold (Xcode project, pnpm workspace, schema)
- Phase 1: Node server (Express, WS relay, multipart upload, Bonjour, QR)
- Phase 2: iOS AR capture (ARSessionManager, SessionRecorder, SessionStore)
- Phase 3: iOS sensors + touch (SensorManager 100Hz, TouchOverlayView, markers)
- Phase 4: iOS networking (WebSocketClient 16ms batches, NWBrowser, Uploader)
- Phase 5: Viewer (R3F scene, Phone mesh, Trail, Timeline, live+replay modes)
- Phase 6: Blender export (generate.ts with pos_arkit_to_blender + quat_json_to_blender)

Note: After adding new Swift files, run `xcodegen generate` from ios/ before building.

## Running it
- `pnpm dev` — server + viewer in watch mode
- Xcode: open `ios/MocapCapture.xcodeproj`, pick your device, Cmd+R. Must run
  on physical device; ARKit does not work in the simulator.
- `xcodebuild -scheme MocapCapture -destination 'generic/platform=iOS' build`
  — use this for CI / Claude Code verification that Swift compiles.
- `pnpm typecheck` — TypeScript must pass before committing.

## Testing
- Fixtures in `shared/schema/fixtures/` validate both Swift decoder and TS parser.
- Blender exporter: snapshot-test the emitted .py against a known-good fixture.
- Coordinate conversions: unit-test both directions with a handful of cardinal
  rotations (identity, 90° around each axis).

## What NOT to do
- Don't do coordinate conversion anywhere outside exporters/blender/generate.ts.
- Don't add Plane Detection, Scene Reconstruction, or Face Tracking to the
  ARKit config unless explicitly building a feature that needs it. They cost
  battery and thermal headroom.
- Don't make live streaming the source of truth. The on-device recording is
  authoritative; WebSocket is just a preview feed.
- Don't stream video over WebSocket. Write to local file, upload on stop.
- Don't assume sample timestamps are monotonic or evenly spaced. They aren't.
  Always sort by t on ingest and interpolate on playback.

## Roadmap / Future work

### Data Quality & Reliability
- [ ] **Tracking-quality visualization.** Color the trail by `tracking` state. In `viewer/src/scene/Trail.tsx`, pass per-vertex colors to the `<Line>` component keyed on each `PoseSample.tracking` value. In `exporters/blender/generate.ts`, emit a custom-property curve (`phone_rig["tracking_quality"]`) with values 0/1/2 so animators can see drops in the graph editor.
- [ ] **IMU-ARKit sensor fusion.** Add a complementary or Kalman filter in `ios/MocapCapture/Capture/ARSessionManager.swift` (or a new `FusionManager.swift`). When `trackingState == .limited`, dead-reckon rotation from 100 Hz IMU gyro, blending back to ARKit when tracking returns. Keep filter state on `recorderQueue` in `SessionRecorder`.
- [ ] **Camera intrinsics export.** Read `frame.camera.intrinsics` (3×3) and `frame.camera.projectionMatrix` in `ARSessionManager`. Add an `intrinsics` field to `PoseSample` in `shared/schema/session.schema.json`, propagate to Swift Codable structs and TS interfaces. In the Blender exporter, set `cam.data.lens` dynamically from intrinsics focal length rather than hardcoding 26 mm.
- [ ] **Multi-device clock sync.** Implement ping/pong RTT measurement in `server/src/ws.ts` (new `type: "timesync"` message). Phone sends its monotonic clock, server responds with its clock + one-way latency. Store the offset in `WebSocketClient.swift` and apply to all timestamps before streaming.

### Multi-Device & Collaboration
- [ ] **Multi-phone streaming.** Fan out batches tagged with `deviceId` in `server/src/ws.ts`. In `viewer/src/state/session.ts`, change `livePoses` from a flat array to `Map<string, PoseSample[]>`. Render one `<Phone>` per device in `LiveMode.tsx` with distinct colors.
- [ ] **Shared origin via ArUco/QR.** Enable `ARWorldTrackingConfiguration.detectionImages` on iOS with a known printed marker. On detection, compute the transform from marker to world origin and rebase all subsequent poses. Store as `session.calibration.worldOrigin` in the schema.
- [ ] **Ground-plane calibration.** Add a calibration UI in `ios/MocapCapture/Views/` where the user taps three floor points. Use `ARFrame.raycastQuery` to get 3D hit points, fit a plane, compute rotation to align Y-up with the plane normal. Store as `session.calibration.groundPlane`.
- [ ] **Session merge CLI.** New `exporters/merge.ts` that reads N session JSONs, applies per-device time offsets, writes a combined session with `deviceId` on each sample. The Blender exporter would emit one rig per device.

### Export & Pipeline Integration
- [ ] **FBX/Alembic.** Use Blender's headless mode (`blender --background --python rig.py`) and add `bpy.ops.export_scene.fbx()` / `bpy.ops.wm.alembic_export()` calls at the end of the generated script. New CLI flags `--format fbx|alembic`.
- [ ] **USD export.** New `exporters/usd/generate.ts`. Generate Python using `pxr.Usd`, `pxr.UsdGeom` to create `UsdGeomXform` with keyframed `xformOp:translate` + `xformOp:orient`, plus `UsdGeomCamera` with focal length from intrinsics.
- [ ] **Bezier keyframe interpolation.** In `exporters/blender/generate.ts`, after inserting keyframes, emit Python that iterates `rig.animation_data.action.fcurves` and sets `interpolation = 'BEZIER'`, `handle_type = 'AUTO_CLAMPED'`. Smoother curves, smaller keyframe count.
- [ ] **IMU CSV/channel export.** Add `--imu` flag to the exporter. Write a flat CSV sidecar (`t,ax,ay,az,gx,gy,gz,qx,qy,qz,qw`) and optionally emit custom-property keyframe channels on the rig in Blender.

### Viewer & Playback
- [ ] **Camera frustum.** In `viewer/src/scene/Phone.tsx`, add a wireframe cone child to the phone group representing the camera FOV. Compute half-angles from 26 mm equivalent (or live intrinsics). Toggle via a Zustand flag.
- [ ] **Split-screen compare.** New `viewer/src/modes/CompareMode.tsx`. Two `<Canvas>` side by side, each with their own `useReplay` but sharing a single `playbackT`. Add `compare` mode to `SessionState`.
- [ ] **IMU graphs panel.** New `viewer/src/ui/ImuPanel.tsx`. Draw accel/gyro traces on a `<canvas>` element using `requestAnimationFrame` synced to `playbackT`. Read `replaySession.imu`. No chart library — raw canvas 2D.
- [ ] **Session metadata overlay.** New `viewer/src/ui/SessionInfo.tsx`. Show device model, duration, sample counts, tracking-quality histogram (% normal/limited/notAvailable). Compute from `replaySession` in a `useMemo`.

### iOS App Hardening
- [ ] **WebSocket auto-reconnect.** In `WebSocketClient.swift`, add a `scheduleReconnect()` with exponential backoff (1s/2s/4s/…/30s max). Call from `didCloseWith` delegate when recording is active. Pending batches keep accumulating in `SessionRecorder` during the gap and flush on reconnect.
- [ ] **Background keep-alive.** In `SessionRecorder.start()`, begin an `AVAudioSession` with category `.playback` and a silent audio player, plus `UIApplication.beginBackgroundTask`. Prevents iOS from suspending mid-recording on app-switch.
- [ ] **On-device trim.** Add `TrimView.swift`. Range slider over `session.duration`. On confirm, filter pose/imu/touch arrays to `[startT, endT]` and rebase timestamps before upload. Modify `SessionEncoder` to accept a trim range.
- [ ] **Persistent upload queue.** Write session JSON to `FileManager.default.urls(for: .documentDirectory)` immediately on `stop()`. Track status in `PendingUploads.plist`. Scan and retry on app launch. Modify `Uploader.swift` to read from disk.

### Server & Infrastructure
- [ ] **Backpressure.** In `server/src/ws.ts`, check `ws.bufferedAmount` before each fan-out send. If above threshold (~256 KB), skip that viewer for the batch. Prevents memory growth when a viewer tab is backgrounded.
- [ ] **Session auth tokens.** On capture `identify`, generate a random token and return in `ack`. Viewers must include the token. Store in `Map<sessionId, token>` in `ws.ts`.
- [ ] **Gzip compression.** Add `compression` middleware in `server/src/index.ts`. Accept `Content-Encoding: gzip` in the multer upload handler. Session JSON for a 5-min take can be 20–50 MB; gzip typically 10:1.
- [ ] **Server-side export endpoint.** New route `GET /sessions/:id/export?fps=30&camera=true` in `server/src/http.ts`. Refactor `exporters/blender/generate.ts` to export a `generateScript(session, opts)` function, call it in-process, return `.py` as `text/x-python`.
