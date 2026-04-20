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
        gap: 6,
        fontFamily: "var(--cond)",
        fontWeight: 600,
        fontSize: 9,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: cameraFollow ? "var(--amber)" : "var(--text-dim)",
        background: "transparent",
        border: `1px solid ${cameraFollow ? "rgba(224,124,42,0.3)" : "var(--border-hi)"}`,
        padding: "2px 8px",
        cursor: "pointer",
        transition: "all 0.1s",
      }}
      onMouseEnter={(e) => {
        if (!cameraFollow) {
          (e.currentTarget as HTMLElement).style.color = "var(--text-mid)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--text-dim)";
        }
      }}
      onMouseLeave={(e) => {
        if (!cameraFollow) {
          (e.currentTarget as HTMLElement).style.color = "var(--text-dim)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hi)";
        }
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: cameraFollow ? "var(--amber)" : "var(--text-dim)",
          transition: "background 0.1s",
        }}
      />
      {cameraFollow ? "Follow" : "Orbit"}
    </button>
  );
}
