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
 */
const ARKIT_PORTRAIT_CORRECTION = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 0, 1),
  Math.PI / 2
);

export function Phone() {
  const groupRef = useRef<THREE.Group>(null);
  const targetQuat = useRef(new THREE.Quaternion());

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
        group.quaternion.copy(rp.quaternion).multiply(ARKIT_PORTRAIT_CORRECTION);
      }
      return;
    }

    if (mode === "live") {
      const poses = store.livePoses;
      if (poses.length > 0) {
        const latest = poses[poses.length - 1];
        group.position.set(latest.p[0], latest.p[1], latest.p[2]);
        targetQuat.current
          .set(latest.q[0], latest.q[1], latest.q[2], latest.q[3])
          .multiply(ARKIT_PORTRAIT_CORRECTION);
        group.quaternion.slerp(targetQuat.current, DAMPING);
      } else if (store.liveImuQuat) {
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
      {/* Body — medium slate grey, visible against dark bg */}
      <RoundedBox args={[0.072, 0.147, 0.008]} radius={0.008} smoothness={4}>
        <meshStandardMaterial color="#5c5c72" roughness={0.3} metalness={0.7} />
      </RoundedBox>

      {/* Screen */}
      <mesh position={[0, 0, 0.0041]}>
        <planeGeometry args={[0.06, 0.13]} />
        <meshStandardMaterial
          color="#0a0a18"
          emissive="#1a2866"
          emissiveIntensity={0.8}
        />
      </mesh>

      {/* Camera dot */}
      <mesh position={[0, 0.063, 0.0042]}>
        <circleGeometry args={[0.004, 16]} />
        <meshStandardMaterial color="#040410" />
      </mesh>

      {/* Axis arrows: R=X G=Y B=Z */}
      <primitive
        object={new THREE.ArrowHelper(
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(0, 0, 0),
          0.06, 0xe03030, 0.012, 0.008
        )}
      />
      <primitive
        object={new THREE.ArrowHelper(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, 0, 0),
          0.06, 0x30c060, 0.012, 0.008
        )}
      />
      <primitive
        object={new THREE.ArrowHelper(
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 0, 0),
          0.06, 0x3070e0, 0.012, 0.008
        )}
      />
    </group>
  );
}
