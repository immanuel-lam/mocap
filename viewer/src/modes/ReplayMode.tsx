import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { WorldGrid } from "../scene/WorldGrid";
import { Phone } from "../scene/Phone";
import { Trail } from "../scene/Trail";
import { useSessionStore } from "../state/session";
import { Timeline } from "../ui/Timeline";

function ReplayScene() {
  const cameraFollow = useSessionStore((s) => s.cameraFollow);
  return (
    <>
      <color attach="background" args={["#dcdce8"]} />
      <ambientLight intensity={0.9} color="#ffffff" />
      <directionalLight position={[3, 6, 4]} intensity={1.0} color="#ffffff" />
      <pointLight position={[-3, 2, -3]} intensity={0.3} color="#c0d0ff" />
      <WorldGrid />
      <Phone />
      <Trail />
      <ReplayCameraFollower />
      {!cameraFollow && <OrbitControls makeDefault dampingFactor={0.08} enableDamping />}
    </>
  );
}

function ReplayCameraFollower() {
  const offset = useRef(new THREE.Vector3(0, 0.2, 0.5));
  const targetPos = useRef(new THREE.Vector3());

  useFrame(({ camera }) => {
    const store = useSessionStore.getState();
    if (!store.cameraFollow) return;
    const session = store.replaySession;
    if (!session || session.pose.length === 0) return;

    const t = store.playbackT;
    const poses = session.pose;
    let idx = 0;
    for (let i = 0; i < poses.length; i++) {
      if (poses[i].t <= t) idx = i;
      else break;
    }
    const p = poses[idx];
    const phonePos = new THREE.Vector3(p.p[0], p.p[1], p.p[2]);
    const phoneQuat = new THREE.Quaternion(p.q[0], p.q[1], p.q[2], p.q[3]);
    const camOffset = offset.current.clone().applyQuaternion(phoneQuat);
    targetPos.current.copy(phonePos).add(camOffset);
    camera.position.lerp(targetPos.current, 0.1);
    camera.lookAt(phonePos);
  });

  return null;
}

/** Corner registration marks (same as LiveMode) */
function CornerMarks() {
  const base: React.CSSProperties = { position: "absolute", width: 16, height: 16, pointerEvents: "none" };
  return (
    <>
      <div style={{ ...base, top: 8, left: 8, borderTop: "1px solid rgba(0,0,0,0.15)", borderLeft: "1px solid rgba(0,0,0,0.15)" }} />
      <div style={{ ...base, top: 8, right: 8, borderTop: "1px solid rgba(0,0,0,0.15)", borderRight: "1px solid rgba(0,0,0,0.15)" }} />
      <div style={{ ...base, bottom: 72, left: 8, borderBottom: "1px solid rgba(0,0,0,0.15)", borderLeft: "1px solid rgba(0,0,0,0.15)" }} />
      <div style={{ ...base, bottom: 72, right: 8, borderBottom: "1px solid rgba(0,0,0,0.15)", borderRight: "1px solid rgba(0,0,0,0.15)" }} />
    </>
  );
}

export function ReplayMode() {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }}>
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <Canvas
          camera={{ position: [2, 2, 2], fov: 55 }}
          style={{ width: "100%", height: "100%", background: "#dcdce8" }}
          gl={{ antialias: true, alpha: false }}
        >
          <ReplayScene />
        </Canvas>
        <CornerMarks />
      </div>
      <Timeline />
    </div>
  );
}
