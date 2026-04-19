import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSessionStore } from "../state/session";
import type { PoseSample } from "../state/session";

function binarySearchBracket(
  samples: PoseSample[],
  t: number
): [number, number] {
  let lo = 0;
  let hi = samples.length - 1;
  if (hi < 0) return [-1, -1];
  if (t <= samples[0].t) return [0, 0];
  if (t >= samples[hi].t) return [hi, hi];

  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= t) lo = mid;
    else hi = mid;
  }
  return [lo, hi];
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();

export interface ReplayPose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

export function useReplay(): { pose: ReplayPose | null } {
  const resultPos = useRef(new THREE.Vector3());
  const resultQuat = useRef(new THREE.Quaternion());
  const poseRef = useRef<ReplayPose | null>(null);

  useFrame((_, delta) => {
    const store = useSessionStore.getState();
    const session = store.replaySession;
    if (!session || session.pose.length === 0) {
      poseRef.current = null;
      return;
    }

    // Advance playback time
    if (store.playing) {
      const newT = Math.min(
        store.playbackT + delta * 1000 * store.speed,
        session.duration
      );
      store.setPlaybackT(newT);
      if (newT >= session.duration) {
        store.setPlaying(false);
      }
    }

    const t = useSessionStore.getState().playbackT;
    const poses = session.pose;
    const [i, j] = binarySearchBracket(poses, t);
    if (i < 0) {
      poseRef.current = null;
      return;
    }

    const a = poses[i];
    const b = poses[j];

    if (i === j) {
      resultPos.current.set(a.p[0], a.p[1], a.p[2]);
      resultQuat.current.set(a.q[0], a.q[1], a.q[2], a.q[3]);
    } else {
      const alpha = (t - a.t) / (b.t - a.t);
      _v1.set(a.p[0], a.p[1], a.p[2]);
      _v2.set(b.p[0], b.p[1], b.p[2]);
      resultPos.current.lerpVectors(_v1, _v2, alpha);

      _q1.set(a.q[0], a.q[1], a.q[2], a.q[3]);
      _q2.set(b.q[0], b.q[1], b.q[2], b.q[3]);
      resultQuat.current.slerpQuaternions(_q1, _q2, alpha);
    }

    poseRef.current = {
      position: resultPos.current,
      quaternion: resultQuat.current,
    };
  });

  return { get pose() { return poseRef.current; } };
}
