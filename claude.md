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
