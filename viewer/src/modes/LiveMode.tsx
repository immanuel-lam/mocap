import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { WorldGrid } from "../scene/WorldGrid";
import { Phone } from "../scene/Phone";
import { Trail } from "../scene/Trail";
import { useSessionStore } from "../state/session";

function CameraFollower() {
  const offset = useRef(new THREE.Vector3(0, 0.2, 0.5));
  const targetPos = useRef(new THREE.Vector3());

  useFrame(({ camera }) => {
    const store = useSessionStore.getState();
    if (!store.cameraFollow) return;
    const poses = store.livePoses;
    if (poses.length === 0) return;

    const latest = poses[poses.length - 1];
    const phonePos = new THREE.Vector3(latest.p[0], latest.p[1], latest.p[2]);
    const phoneQuat = new THREE.Quaternion(latest.q[0], latest.q[1], latest.q[2], latest.q[3]);
    const camOffset = offset.current.clone().applyQuaternion(phoneQuat);
    targetPos.current.copy(phonePos).add(camOffset);
    camera.position.lerp(targetPos.current, 0.1);
    camera.lookAt(phonePos);
  });

  return null;
}

function LiveStats() {
  const poseCount = useSessionStore((s) => s.livePoses.length);
  const latestPose = useSessionStore((s) =>
    s.livePoses.length > 0 ? s.livePoses[s.livePoses.length - 1] : null
  );
  const fmt = (n: number) => n.toFixed(3).padStart(7);
  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 14,
        display: "flex",
        flexDirection: "column",
        gap: 3,
        pointerEvents: "none",
      }}
    >
      <StatLine label="POSE" value={String(poseCount)} />
      {latestPose && (
        <>
          <StatLine label="X" value={fmt(latestPose.p[0])} />
          <StatLine label="Y" value={fmt(latestPose.p[1])} />
          <StatLine label="Z" value={fmt(latestPose.p[2])} />
          <StatLine label="TRK" value={latestPose.tracking.slice(0, 3).toUpperCase()} />
        </>
      )}
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
      <span style={{ fontFamily: "var(--cond)", fontSize: 8, letterSpacing: "0.15em", color: "var(--text-dim)", textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--green)", textShadow: "var(--green-glow)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
}

/** Viewport corner registration marks */
function CornerMarks() {
  const style = (corner: string): React.CSSProperties => ({
    position: "absolute",
    width: 16,
    height: 16,
    pointerEvents: "none",
    ...(corner === "tl" ? { top: 8, left: 8, borderTop: "1px solid rgba(61,255,143,0.3)", borderLeft: "1px solid rgba(61,255,143,0.3)" } : {}),
    ...(corner === "tr" ? { top: 8, right: 8, borderTop: "1px solid rgba(61,255,143,0.3)", borderRight: "1px solid rgba(61,255,143,0.3)" } : {}),
    ...(corner === "bl" ? { bottom: 8, left: 8, borderBottom: "1px solid rgba(61,255,143,0.3)", borderLeft: "1px solid rgba(61,255,143,0.3)" } : {}),
    ...(corner === "br" ? { bottom: 8, right: 8, borderBottom: "1px solid rgba(61,255,143,0.3)", borderRight: "1px solid rgba(61,255,143,0.3)" } : {}),
  });
  return (
    <>
      <div style={style("tl")} />
      <div style={style("tr")} />
      <div style={style("bl")} />
      <div style={style("br")} />
    </>
  );
}

export function LiveMode() {
  const cameraFollow = useSessionStore((s) => s.cameraFollow);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [2, 2, 2], fov: 55 }}
        style={{ width: "100%", height: "100%", background: "#06070a" }}
        gl={{ antialias: true, alpha: false }}
      >
        {/* Cinematic lighting */}
        <ambientLight intensity={0.15} color="#4060ff" />
        <directionalLight position={[3, 6, 4]} intensity={1.2} color="#ffffff" />
        <pointLight position={[-3, 2, -3]} intensity={0.4} color="#00ffaa" />

        <WorldGrid />
        <Phone />
        <Trail />
        <CameraFollower />
        {!cameraFollow && <OrbitControls makeDefault dampingFactor={0.08} enableDamping />}
      </Canvas>

      <CornerMarks />
      <LiveStats />
    </div>
  );
}
