// Blender export: session JSON → Blender Python script
// Usage: npx tsx generate.ts <session.json> [--fps 30] [--camera] [--out out.py]

import * as fs from "fs";
import * as path from "path";

// --- Types ---

interface PoseSample {
  t: number;
  p: [number, number, number];
  q: [number, number, number, number]; // [x, y, z, w]
  tracking: string;
}

interface Marker {
  t: number;
  label: string;
}

interface Session {
  version: number;
  id: string;
  createdAt: string;
  device: {
    model: string;
    iosVersion: string;
    hasLiDAR: boolean;
    screen: { width: number; height: number; scale: number };
  };
  pose: PoseSample[];
  imu: unknown[];
  touches: unknown[];
  markers: Marker[];
  duration: number;
}

// --- Arg parsing ---

function parseArgs(argv: string[]): {
  sessionPath: string;
  fps: number;
  camera: boolean;
  outPath: string | null;
} {
  const args = argv.slice(2);
  let sessionPath = "";
  let fps = 30;
  let camera = false;
  let outPath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--fps") {
      const val = parseInt(args[++i], 10);
      if (isNaN(val) || val <= 0) {
        console.error("--fps must be a positive integer");
        process.exit(1);
      }
      fps = val;
    } else if (arg === "--camera" || arg === "--include-camera") {
      camera = true;
    } else if (arg === "--out") {
      outPath = args[++i];
    } else if (!arg.startsWith("--") && !sessionPath) {
      sessionPath = arg;
    }
  }

  if (!sessionPath) {
    console.error(
      "Usage: npx tsx generate.ts <session.json> [--fps 30] [--camera] [--out out.py]"
    );
    process.exit(1);
  }

  return { sessionPath, fps, camera, outPath };
}

// --- Portrait correction (same as viewer's ARKIT_PORTRAIT_CORRECTION) ---
// ARKit's back camera sensor is physically in landscape orientation.
// Correct by right-multiplying each quaternion by Q(axis=Z, angle=+π/2).

const CORR = {
  x: 0,
  y: 0,
  z: Math.SQRT2 / 2, // sin(π/4)
  w: Math.SQRT2 / 2, // cos(π/4)
};

function applyPortraitCorrection(
  q: [number, number, number, number]
): [number, number, number, number] {
  // result = q * CORR  (right multiply, in quaternion math)
  const [ax, ay, az, aw] = q;
  const { x: bx, y: by, z: bz, w: bw } = CORR;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

// --- Decimation ---

interface DecimatedFrame {
  frame: number;
  p: [number, number, number];
  q: [number, number, number, number]; // portrait-corrected, ARKit frame
}

function decimatePoses(poses: PoseSample[], fps: number): DecimatedFrame[] {
  if (poses.length === 0) return [];

  const intervalMs = 1000 / fps;
  const result: DecimatedFrame[] = [];
  let nextTargetMs = 0;
  let poseIdx = 0;
  const maxT = poses[poses.length - 1].t;
  const epsilon = intervalMs * 0.5;

  while (nextTargetMs <= maxT + epsilon) {
    while (
      poseIdx < poses.length - 1 &&
      Math.abs(poses[poseIdx + 1].t - nextTargetMs) <=
        Math.abs(poses[poseIdx].t - nextTargetMs)
    ) {
      poseIdx++;
    }

    const sample = poses[poseIdx];
    const frame = Math.round((nextTargetMs / 1000) * fps);
    const corrected = applyPortraitCorrection(sample.q);

    result.push({ frame, p: sample.p, q: corrected });
    nextTargetMs += intervalMs;
  }

  return result;
}

// --- Python generation ---

function py(n: number): string {
  // Enough precision for sub-millimetre accuracy, no trailing zeros
  return parseFloat(n.toPrecision(8)).toString();
}

function generatePythonScript(
  session: Session,
  frames: DecimatedFrame[],
  fps: number,
  camera: boolean
): string {
  const maxFrame = frames.length > 0 ? frames[frames.length - 1].frame : 0;

  const dataLines = frames
    .map(
      (f) =>
        `    (${f.frame},(${py(f.p[0])},${py(f.p[1])},${py(f.p[2])}),(${py(f.q[0])},${py(f.q[1])},${py(f.q[2])},${py(f.q[3])})),`
    )
    .join("\n");

  const markerLines = session.markers
    .map((m) => {
      const label = m.label.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      return `    ('${label}',${py(m.t)}),`;
    })
    .join("\n");

  // iPhone main wide camera: ~26 mm full-frame equivalent
  // Screen is portrait so portrait width/height for render
  const screenW = Math.round(session.device.screen.width * session.device.screen.scale);
  const screenH = Math.round(session.device.screen.height * session.device.screen.scale);
  const renderW = Math.min(screenW, screenH); // portrait: narrow = width
  const renderH = Math.max(screenW, screenH);

  return `\
# Blender Python – MoCap session ${session.id}
# ${session.createdAt}  device: ${session.device.model}
#
# Run in Blender ≥ 3.0:  Scripting tab → Open → Run Script
# Keyframes are at ${fps} fps.  Portrait correction is pre-baked.
#
# Coordinate system: ARKit Y-up  →  Blender Z-up
#   pos_arkit_to_blender : (x,y,z) → (x,-z,y)
#   quat_json_to_blender : reorders [x,y,z,w] → (w,x,y,z) and applies
#                          -90° X rotation for axis-swap

import bpy, math, mathutils

# ── helpers ──────────────────────────────────────────────────────────────────

def pos_arkit_to_blender(p):
    return (p[0], -p[2], p[1])

def quat_json_to_blender(q):
    """JSON [x,y,z,w] → Blender Quaternion in Z-up frame."""
    x, y, z, w = q
    q_arkit  = mathutils.Quaternion((w, x, y, z))
    q_change = mathutils.Quaternion((math.sqrt(2)/2, math.sqrt(2)/2, 0, 0))
    return q_change @ q_arkit

# ── data ─────────────────────────────────────────────────────────────────────

FPS        = ${fps}
SESSION_ID = '${session.id}'

# (frame, (px,py,pz), (qx,qy,qz,qw))  — portrait-corrected, ARKit frame
KEYFRAMES = [
${dataLines}
]

MARKERS = [
${markerLines}
]

# ── scene ─────────────────────────────────────────────────────────────────────

col = bpy.data.collections.new('mocap_' + SESSION_ID[:8])
bpy.context.scene.collection.children.link(col)

bpy.context.scene.render.fps   = FPS
bpy.context.scene.frame_start  = 0
bpy.context.scene.frame_end    = ${maxFrame}

# ── phone rig (empty) ─────────────────────────────────────────────────────────

bpy.ops.object.empty_add(type='PLAIN_AXES')
rig = bpy.context.active_object
rig.name = 'phone_rig'
rig.rotation_mode = 'QUATERNION'
for c in rig.users_collection: c.objects.unlink(rig)
col.objects.link(rig)

for frame, pos, quat in KEYFRAMES:
    bpy.context.scene.frame_set(frame)
    rig.location            = pos_arkit_to_blender(pos)
    q = quat_json_to_blender(quat)
    rig.rotation_quaternion = (q.w, q.x, q.y, q.z)
    rig.keyframe_insert(data_path='location',            frame=frame)
    rig.keyframe_insert(data_path='rotation_quaternion', frame=frame)

${
  camera
    ? `\
# ── camera ────────────────────────────────────────────────────────────────────
# Parented to the phone rig.  No additional local offset needed because the
# portrait correction is already baked into the keyframe quaternions above.

bpy.ops.object.camera_add()
cam      = bpy.context.active_object
cam.name = 'mocap_camera'
for c in cam.users_collection: c.objects.unlink(cam)
col.objects.link(cam)

cam.parent        = rig
cam.data.lens     = 26          # iPhone main wide ≈ 26 mm FF equivalent
cam.data.sensor_fit = 'VERTICAL'

# Match iPhone portrait render resolution
bpy.context.scene.render.resolution_x = ${renderW}
bpy.context.scene.render.resolution_y = ${renderH}
bpy.context.scene.render.resolution_percentage = 50  # 50 % for preview speed

# Make this the active render camera
bpy.context.scene.camera = cam
print(f'Camera set: {cam.name}  lens={cam.data.lens}mm  {${renderW}}x{${renderH}}')
`
    : `# Camera not included. Re-run with --camera to add one.\n`
}
# ── timeline markers ──────────────────────────────────────────────────────────

for label, t_ms in MARKERS:
    bpy.context.scene.timeline_markers.new(label, frame=round(t_ms / 1000 * FPS))

# ── done ──────────────────────────────────────────────────────────────────────

bpy.context.scene.frame_set(0)
print(f'MoCap import complete: {len(KEYFRAMES)} keyframes, session {SESSION_ID}')
`;
}

// --- Main ---

function main(): void {
  const { sessionPath, fps, camera, outPath } = parseArgs(process.argv);

  const resolvedPath = path.resolve(sessionPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Session file not found: ${resolvedPath}`);
    process.exit(1);
  }

  const session: Session = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));

  if (!session.pose || session.pose.length === 0) {
    console.error("Session contains no pose data.");
    process.exit(1);
  }

  session.pose.sort((a, b) => a.t - b.t);

  const frames = decimatePoses(session.pose, fps);
  const script = generatePythonScript(session, frames, fps, camera);

  const outputPath = outPath
    ? path.resolve(outPath)
    : path.resolve(`${session.id}.py`);

  fs.writeFileSync(outputPath, script, "utf-8");
  console.log(
    `Wrote ${frames.length} keyframes @ ${fps} fps → ${outputPath}${camera ? "  (camera included)" : ""}`
  );
}

main();
