import { useSessionStore } from "../state/session";

export function CameraFollowToggle() {
  const cameraFollow = useSessionStore((s) => s.cameraFollow);
  const setCameraFollow = useSessionStore((s) => s.setCameraFollow);

  return (
    <button
      onClick={() => setCameraFollow(!cameraFollow)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--cond)",
        fontWeight: 600,
        fontSize: 10,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: cameraFollow ? "var(--amber)" : "var(--text-mid)",
        background: cameraFollow ? "var(--amber-dim)" : "transparent",
        border: `1px solid ${cameraFollow ? "rgba(255,155,56,0.25)" : "var(--border-hi)"}`,
        borderRadius: 2,
        padding: "3px 10px",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {/* Toggle pip */}
      <span
        style={{
          display: "inline-block",
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: cameraFollow ? "var(--amber)" : "var(--text-dim)",
          boxShadow: cameraFollow ? "var(--amber-glow)" : "none",
          transition: "all 0.15s",
        }}
      />
      {cameraFollow ? "Following" : "Orbit"}
    </button>
  );
}
