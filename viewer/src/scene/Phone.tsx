import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { useSessionStore } from "../state/session";
import { useReplay } from "../hooks/useReplay";

const DAMPING = 0.25;

/**
 * ARKit's back camera sensor is physically mounted in landscape orientation.
 * frame.camera.transform uses the sensor's native frame, not the portrait UI frame.
 * Correct by right-multiplying (local-space) a fixed +90° rotation around Z.
 * Applied once at module level — it never changes.
 */
const ARKIT_PORTRAIT_CORRECTION = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 0, 1),
  Math.PI / 2
);

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
      const rp = replayResult.pose;
      if (rp) {
        group.position.copy(rp.position);
        // Apply portrait correction to replay data (same sensor offset as live).
        group.quaternion.copy(rp.quaternion).multiply(ARKIT_PORTRAIT_CORRECTION);
      }
      return;
    }

    if (mode === "live") {
      group.position.set(0, 0, 0);

      const poses = store.livePoses;
      if (poses.length > 0) {
        const q = poses[poses.length - 1].q;
        targetQuat.current
          .set(q[0], q[1], q[2], q[3])
          .multiply(ARKIT_PORTRAIT_CORRECTION);
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
