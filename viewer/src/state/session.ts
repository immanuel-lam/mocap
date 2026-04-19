import { create } from "zustand";

export interface PoseSample {
  t: number;
  p: [number, number, number];
  q: [number, number, number, number];
  tracking: "normal" | "limited" | "notAvailable";
  trackingReason?:
    | "initializing"
    | "relocalizing"
    | "excessiveMotion"
    | "insufficientFeatures";
}

export interface ImuSample {
  t: number;
  a: number[];
  ua: number[];
  rr: number[];
  qi: number[];
  mag?: number[];
}

export interface TouchEvent {
  t: number;
  kind: "start" | "move" | "end";
  id: number;
  x: number;
  y: number;
  force?: number;
}

export interface Marker {
  t: number;
  label: string;
}

export interface Session {
  version: 1;
  id: string;
  createdAt: string;
  device: {
    model: string;
    iosVersion: string;
    hasLiDAR: boolean;
    screen: { width: number; height: number; scale: number };
  };
  pose: PoseSample[];
  imu: ImuSample[];
  touches: TouchEvent[];
  markers: Marker[];
  duration: number;
}

export interface LiveBatch {
  sessionId?: string;
  pose?: PoseSample[];
  imu?: ImuSample[];
  touches?: TouchEvent[];
}

interface SessionState {
  mode: "live" | "replay";
  setMode: (mode: "live" | "replay") => void;

  liveSessionId: string | null;
  livePoses: PoseSample[];
  liveTouches: TouchEvent[];
  pushLiveBatch: (batch: LiveBatch) => void;

  replaySession: Session | null;
  setReplaySession: (session: Session | null) => void;

  playbackT: number;
  setPlaybackT: (t: number) => void;

  playing: boolean;
  setPlaying: (v: boolean) => void;

  speed: number;
  setSpeed: (v: number) => void;

  cameraFollow: boolean;
  setCameraFollow: (v: boolean) => void;
}

const MAX_LIVE_POSES = 2000;
const MAX_LIVE_TOUCHES = 200;

export const useSessionStore = create<SessionState>((set) => ({
  mode: "live",
  setMode: (mode) => set({ mode }),

  liveSessionId: null,
  livePoses: [],
  liveTouches: [],
  pushLiveBatch: (batch) =>
    set((state) => {
      const nextPoses = batch.pose
        ? [...state.livePoses, ...batch.pose].slice(-MAX_LIVE_POSES)
        : state.livePoses;
      const nextTouches = batch.touches
        ? [...state.liveTouches, ...batch.touches].slice(-MAX_LIVE_TOUCHES)
        : state.liveTouches;
      return {
        liveSessionId: batch.sessionId ?? state.liveSessionId,
        livePoses: nextPoses,
        liveTouches: nextTouches,
      };
    }),

  replaySession: null,
  setReplaySession: (session) =>
    set({ replaySession: session, playbackT: 0, playing: false }),

  playbackT: 0,
  setPlaybackT: (t) => set({ playbackT: t }),

  playing: false,
  setPlaying: (v) => set({ playing: v }),

  speed: 1,
  setSpeed: (v) => set({ speed: v }),

  cameraFollow: false,
  setCameraFollow: (v) => set({ cameraFollow: v }),
}));
