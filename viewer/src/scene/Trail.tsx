import { useMemo } from "react";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { useSessionStore } from "../state/session";
import type { PoseSample } from "../state/session";

const MAX_LIVE_TRAIL = 300;

function posesToPoints(poses: PoseSample[]): THREE.Vector3[] {
  return poses.map((s) => new THREE.Vector3(s.p[0], s.p[1], s.p[2]));
}

export function Trail() {
  const mode = useSessionStore((s) => s.mode);
  const livePoses = useSessionStore((s) => s.livePoses);
  const replaySession = useSessionStore((s) => s.replaySession);
  const playbackT = useSessionStore((s) => s.playbackT);

  const points = useMemo(() => {
    if (mode === "live") {
      const slice = livePoses.slice(-MAX_LIVE_TRAIL);
      return posesToPoints(slice);
    }
    if (mode === "replay" && replaySession) {
      const upTo = replaySession.pose.filter((s) => s.t <= playbackT);
      return posesToPoints(upTo);
    }
    return [];
  }, [mode, livePoses, replaySession, playbackT]);

  if (points.length < 2) return null;

  return <Line points={points} color="#3dff8f" lineWidth={1.5} opacity={0.6} transparent />;
}
