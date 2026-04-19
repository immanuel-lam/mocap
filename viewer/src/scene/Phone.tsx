import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { useSessionStore } from "../state/session";
import type { ReplayPose } from "../hooks/useReplay";

const DAMPING = 0.15;

interface PhoneProps {
  replayPose?: ReplayPose | null;
}

export function Phone({ replayPose }: PhoneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3());
  const targetQuat = useRef(new THREE.Quaternion());

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const store = useSessionStore.getState();
    const mode = store.mode;

    if (mode === "replay" && replayPose) {
      group.position.copy(replayPose.position);
      group.quaternion.copy(replayPose.quaternion);
    } else if (mode === "live") {
      const poses = store.livePoses;
      if (poses.length > 0) {
        const latest = poses[poses.length - 1];
        targetPos.current.set(latest.p[0], latest.p[1], latest.p[2]);
        targetQuat.current.set(
          latest.q[0],
          latest.q[1],
          latest.q[2],
          latest.q[3]
        );
        group.position.lerp(targetPos.current, DAMPING);
        group.quaternion.slerp(targetQuat.current, DAMPING);
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Phone body */}
      <RoundedBox
        args={[0.072, 0.147, 0.008]}
        radius={0.008}
        smoothness={4}
      >
        <meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.6} />
      </RoundedBox>

      {/* Screen face on +Z side */}
      <mesh position={[0, 0, 0.0041]}>
        <planeGeometry args={[0.06, 0.13]} />
        <meshStandardMaterial
          color="#222222"
          emissive="#111133"
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
}
