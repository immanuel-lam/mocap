import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { WorldGrid } from "../scene/WorldGrid";
import { Phone } from "../scene/Phone";
import { useSessionStore } from "../state/session";

function LiveStats() {
  const poseCount = useSessionStore((s) => s.livePoses.length);
  const imuQuat = useSessionStore((s) => s.liveImuQuat);
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
      {latestPose ? (
        <>
          <StatLine label="X" value={fmt(latestPose.p[0])} />
          <StatLine label="Y" value={fmt(latestPose.p[1])} />
          <StatLine label="Z" value={fmt(latestPose.p[2])} />
          <StatLine label="TRK" value={latestPose.tracking.slice(0, 3).toUpperCase()} />
        </>
      ) : imuQuat ? (
        <StatLine label="SRC" value="IMU" />
      ) : null}
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
      <span
        style={{
          fontFamily: "var(--cond)",
          fontSize: 8,
          letterSpacing: "0.15em",
          color: "var(--text-dim)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          color: "var(--green)",
          textShadow: "var(--green-glow)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function CornerMarks() {
  const style = (corner: string): React.CSSProperties => ({
    position: "absolute",
    width: 16,
    height: 16,
    pointerEvents: "none",
    ...(corner === "tl"
      ? { top: 8, left: 8, borderTop: "1px solid rgba(61,255,143,0.3)", borderLeft: "1px solid rgba(61,255,143,0.3)" }
      : {}),
    ...(corner === "tr"
      ? { top: 8, right: 8, borderTop: "1px solid rgba(61,255,143,0.3)", borderRight: "1px solid rgba(61,255,143,0.3)" }
      : {}),
    ...(corner === "bl"
      ? { bottom: 8, left: 8, borderBottom: "1px solid rgba(61,255,143,0.3)", borderLeft: "1px solid rgba(61,255,143,0.3)" }
      : {}),
    ...(corner === "br"
      ? { bottom: 8, right: 8, borderBottom: "1px solid rgba(61,255,143,0.3)", borderRight: "1px solid rgba(61,255,143,0.3)" }
      : {}),
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

function WaitingOverlay() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          fontFamily: "var(--cond)",
          fontSize: 11,
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          color: "var(--text-dim)",
        }}
      >
        Awaiting signal
      </span>
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 9,
          color: "var(--text-dim)",
          opacity: 0.5,
        }}
      >
        Start recording on device
      </span>
    </div>
  );
}

export function LiveMode() {
  const poseCount = useSessionStore((s) => s.livePoses.length);
  const imuQuat = useSessionStore((s) => s.liveImuQuat);
  const hasData = poseCount > 0 || imuQuat !== null;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [0, 0.3, 0.5], fov: 45 }}
        style={{ width: "100%", height: "100%", background: "#06070a" }}
        gl={{ antialias: true, alpha: false }}
      >
        <ambientLight intensity={0.2} color="#4060ff" />
        <directionalLight position={[3, 6, 4]} intensity={1.4} color="#ffffff" />
        <pointLight position={[-2, 2, -2]} intensity={0.5} color="#00ffaa" />

        <WorldGrid />
        <Phone />
        <OrbitControls
          makeDefault
          dampingFactor={0.08}
          enableDamping
          target={[0, 0, 0]}
        />
      </Canvas>

      <CornerMarks />
      <LiveStats />
      {!hasData && <WaitingOverlay />}
    </div>
  );
}
