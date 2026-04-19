import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { useSessionStore } from "../state/session";
import { useReplay } from "../hooks/useReplay";

const DAMPING = 0.25;

export function Phone() {
  const groupRef = useRef<THREE.Group>(null);
  const targetQuat = useRef(new THREE.Quaternion());

  // useReplay drives playback time and returns the interpolated pose via
  // a getter — must be accessed inside useFrame, not destructured eagerly.
  const replayResult = useReplay();

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const store = useSessionStore.getState();
    const mode = store.mode;

    if (mode === "replay") {
      // Access getter here (inside useFrame) so we get the current value.
      const rp = replayResult.pose;
      if (rp) {
        group.position.copy(rp.position);
        group.quaternion.copy(rp.quaternion);
      }
      return;
    }

    if (mode === "live") {
      // Fix position at origin — pure tilt demo, no world-space drift.
      group.position.set(0, 0, 0);

      const poses = store.livePoses;
      if (poses.length > 0) {
        // ARKit quaternion: Y-up, same handedness as Three.js — no conversion.
        const q = poses[poses.length - 1].q;
        targetQuat.current.set(q[0], q[1], q[2], q[3]);
        group.quaternion.slerp(targetQuat.current, DAMPING);
      } else if (store.liveImuQuat) {
        // IMU fallback: xArbitraryZVertical (Z-up). Remap to Y-up.
        const [ix, iy, iz, iw] = store.liveImuQuat;
        const imuQ = new THREE.Quaternion(ix, iy, iz, iw);
        const reframe = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(-Math.PI / 2, 0, 0)
        );
        targetQuat.current.copy(reframe).multiply(imuQ);
        group.quaternion.slerp(targetQuat.current, DAMPING);
      }
    }
  });

  return (
    <group ref={groupRef}>
      <RoundedBox args={[0.072, 0.147, 0.008]} radius={0.008} smoothness={4}>
        <meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.6} />
      </RoundedBox>

      {/* Screen face on +Z side */}
      <mesh position={[0, 0, 0.0041]}>
        <planeGeometry args={[0.06, 0.13]} />
        <meshStandardMaterial
          color="#111122"
          emissive="#223366"
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* Camera dot */}
      <mesh position={[0, 0.063, 0.0042]}>
        <circleGeometry args={[0.004, 16]} />
        <meshStandardMaterial color="#050510" />
      </mesh>

      {/* Axis arrows: R=X G=Y B=Z(screen normal) */}
      <primitive
        object={new THREE.ArrowHelper(
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(0, 0, 0),
          0.06, 0xff3333, 0.012, 0.008
        )}
      />
      <primitive
        object={new THREE.ArrowHelper(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, 0, 0),
          0.06, 0x33ff66, 0.012, 0.008
        )}
      />
      <primitive
        object={new THREE.ArrowHelper(
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 0, 0),
          0.06, 0x3388ff, 0.012, 0.008
        )}
      />
    </group>
  );
}
