import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { WorldGrid } from "../scene/WorldGrid";
import { Phone } from "../scene/Phone";
import { Trail } from "../scene/Trail";
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
        top: 10,
        right: 12,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        pointerEvents: "none",
      }}
    >
      <StatLine label="F" value={String(poseCount)} />
      {latestPose ? (
        <>
          <StatLine label="X" value={fmt(latestPose.p[0])} />
          <StatLine label="Y" value={fmt(latestPose.p[1])} />
          <StatLine label="Z" value={fmt(latestPose.p[2])} />
          <StatLine
            label="TRK"
            value={latestPose.tracking.slice(0, 3).toUpperCase()}
            accent={latestPose.tracking === "normal" ? "green" : "amber"}
          />
        </>
      ) : imuQuat ? (
        <StatLine label="SRC" value="IMU" accent="amber" />
      ) : null}
    </div>
  );
}

function StatLine({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "green" | "amber";
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
      <span
        style={{
          fontFamily: "var(--cond)",
          fontSize: 8,
          letterSpacing: "0.14em",
          color: "rgba(180,180,210,0.35)",
          textTransform: "uppercase",
          width: 20,
          textAlign: "right",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          color: accent === "green"
            ? "var(--green)"
            : accent === "amber"
            ? "var(--amber)"
            : "rgba(196,196,212,0.8)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function CornerMarks() {
  const s = (corner: string): React.CSSProperties => ({
    position: "absolute",
    width: 14,
    height: 14,
    pointerEvents: "none",
    ...(corner === "tl" ? { top: 8, left: 8,
      borderTop: "1px solid rgba(180,180,220,0.15)",
      borderLeft: "1px solid rgba(180,180,220,0.15)" } : {}),
    ...(corner === "tr" ? { top: 8, right: 8,
      borderTop: "1px solid rgba(180,180,220,0.15)",
      borderRight: "1px solid rgba(180,180,220,0.15)" } : {}),
    ...(corner === "bl" ? { bottom: 8, left: 8,
      borderBottom: "1px solid rgba(180,180,220,0.15)",
      borderLeft: "1px solid rgba(180,180,220,0.15)" } : {}),
    ...(corner === "br" ? { bottom: 8, right: 8,
      borderBottom: "1px solid rgba(180,180,220,0.15)",
      borderRight: "1px solid rgba(180,180,220,0.15)" } : {}),
  });
  return (
    <>
      <div style={s("tl")} />
      <div style={s("tr")} />
      <div style={s("bl")} />
      <div style={s("br")} />
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
        gap: 6,
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          fontFamily: "var(--cond)",
          fontSize: 10,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: "rgba(180,180,220,0.2)",
        }}
      >
        Awaiting signal
      </span>
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 9,
          color: "rgba(180,180,220,0.1)",
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
        style={{ width: "100%", height: "100%" }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={["#18182a"]} />
        <ambientLight intensity={0.4} color="#8090c0" />
        <directionalLight position={[4, 8, 4]} intensity={1.8} color="#ffffff" />
        <pointLight position={[-3, -1, 3]} intensity={0.6} color="#6080c0" />

        <WorldGrid />
        <Phone />
        <Trail />
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
