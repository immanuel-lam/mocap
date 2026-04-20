import { useCallback } from "react";
import { useSessionStore } from "../state/session";

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${seconds.toFixed(1).padStart(4, "0")}`;
}

const SPEED_OPTIONS = [0.25, 0.5, 1, 2] as const;

export function Timeline() {
  const session   = useSessionStore((s) => s.replaySession);
  const playbackT = useSessionStore((s) => s.playbackT);
  const playing   = useSessionStore((s) => s.playing);
  const speed     = useSessionStore((s) => s.speed);
  const setPlaybackT = useSessionStore((s) => s.setPlaybackT);
  const setPlaying   = useSessionStore((s) => s.setPlaying);
  const setSpeed     = useSessionStore((s) => s.setSpeed);

  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setPlaybackT(Number(e.target.value)),
    [setPlaybackT]
  );

  if (!session) {
    return (
      <div
        className="flex items-center justify-center"
        style={{
          height: 56,
          background: "var(--panel)",
          borderTop: "1px solid var(--border)",
          color: "var(--text-dim)",
          fontFamily: "var(--cond)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontSize: 9,
        }}
      >
        No session loaded
      </div>
    );
  }

  const duration = session.duration;
  const progress = duration > 0 ? (playbackT / duration) * 100 : 0;

  return (
    <div style={{ background: "var(--panel)", borderTop: "1px solid var(--border)", userSelect: "none" }}>

      {/* ── Track ─────────────────────────────────────── */}
      <div style={{ position: "relative", height: 24, borderBottom: "1px solid var(--border)" }}>
        <div style={{ position: "absolute", inset: 0, background: "var(--panel-2)" }} />

        {/* Progress fill */}
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, bottom: 0,
            width: `${progress}%`,
            background: "rgba(224,124,42,0.06)",
            borderRight: "1px solid rgba(224,124,42,0.2)",
            pointerEvents: "none",
          }}
        />

        {/* Marker ticks */}
        {session.markers.map((m, i) => (
          <div
            key={`m-${i}`}
            title={m.label}
            style={{
              position: "absolute",
              top: 0, bottom: 0,
              left: `${(m.t / duration) * 100}%`,
              width: 1,
              background: "var(--amber)",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2, left: 3,
                fontFamily: "var(--mono)",
                fontSize: 7,
                color: "var(--amber)",
                whiteSpace: "nowrap",
                opacity: 0.7,
              }}
            >
              {m.label}
            </span>
          </div>
        ))}

        {/* Touch ticks */}
        {session.touches
          .filter((_, i) => i % 3 === 0)
          .map((te, i) => (
            <div
              key={`t-${i}`}
              style={{
                position: "absolute",
                bottom: 0,
                left: `${(te.t / duration) * 100}%`,
                width: 1,
                height: 3,
                background: "rgba(224,124,42,0.3)",
                pointerEvents: "none",
              }}
            />
          ))}

        {/* Scrubber */}
        <input
          type="range"
          min={0}
          max={duration}
          step={1}
          value={playbackT}
          onChange={handleScrub}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0,
            cursor: "col-resize",
            zIndex: 10,
          }}
        />

        {/* Playhead */}
        <div
          style={{
            position: "absolute",
            top: 0, bottom: 0,
            left: `${progress}%`,
            width: 1,
            background: "var(--amber)",
            pointerEvents: "none",
            zIndex: 5,
          }}
        />
      </div>

      {/* ── Controls ──────────────────────────────────── */}
      <div className="flex items-center gap-4 px-3" style={{ height: 32 }}>

        {/* Play/Pause */}
        <button
          onClick={() => {
            if (!playing && playbackT >= duration) setPlaybackT(0);
            setPlaying(!playing);
          }}
          style={{
            width: 22,
            height: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--amber-dim)",
            border: "1px solid rgba(224,124,42,0.25)",
            cursor: "pointer",
            color: "var(--amber)",
            flexShrink: 0,
          }}
        >
          {playing ? (
            <svg width="8" height="9" viewBox="0 0 8 9" fill="currentColor">
              <rect x="0" y="0" width="2.5" height="9"/>
              <rect x="5.5" y="0" width="2.5" height="9"/>
            </svg>
          ) : (
            <svg width="8" height="9" viewBox="0 0 8 9" fill="currentColor">
              <path d="M0 0 L8 4.5 L0 9 Z"/>
            </svg>
          )}
        </button>

        {/* Speed */}
        <div className="flex items-center" style={{ gap: 1 }}>
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              style={{
                fontFamily: "var(--mono)",
                fontSize: 8,
                padding: "1px 6px",
                border: "1px solid",
                cursor: "pointer",
                transition: "all 0.1s",
                borderColor: speed === s ? "rgba(224,124,42,0.35)" : "var(--border)",
                background: speed === s ? "var(--amber-dim)" : "transparent",
                color: speed === s ? "var(--amber)" : "var(--text-dim)",
              }}
            >
              {s}×
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Time */}
        <div className="flex items-baseline" style={{ gap: 4 }}>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 13,
              fontWeight: 300,
              letterSpacing: "0.04em",
              color: "var(--text)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatTime(playbackT)}
          </span>
          <span style={{ color: "var(--text-dim)", fontSize: 9 }}>/</span>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--text-dim)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
