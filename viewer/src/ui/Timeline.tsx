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
        style={{ height: 64, background: "var(--panel)", borderTop: "1px solid var(--border)", color: "var(--text-dim)", fontFamily: "var(--cond)", letterSpacing: "0.1em", textTransform: "uppercase", fontSize: 10 }}
      >
        No session loaded
      </div>
    );
  }

  const duration = session.duration;
  const progress = duration > 0 ? (playbackT / duration) * 100 : 0;

  return (
    <div
      style={{
        background: "var(--panel)",
        borderTop: "1px solid var(--border)",
        userSelect: "none",
      }}
    >
      {/* ── Track area ─────────────────────────────────── */}
      <div style={{ position: "relative", height: 28, borderBottom: "1px solid var(--border)" }}>
        {/* Track background — subtle tape-strip texture */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--panel-2)",
          }}
        />

        {/* Progress fill */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: `${progress}%`,
            background: "linear-gradient(to right, rgba(5,150,105,0.08), rgba(5,150,105,0.04))",
            borderRight: "1px solid rgba(5,150,105,0.2)",
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
              top: 0,
              bottom: 0,
              left: `${(m.t / duration) * 100}%`,
              width: 1,
              background: "var(--amber)",
              boxShadow: "var(--amber-glow)",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: 3,
                fontFamily: "var(--mono)",
                fontSize: 8,
                color: "var(--amber)",
                whiteSpace: "nowrap",
                letterSpacing: "0.04em",
              }}
            >
              {m.label}
            </span>
          </div>
        ))}

        {/* Touch ticks — tiny dots at the bottom */}
        {session.touches
          .filter((_, i) => i % 3 === 0)  // thin out dense sequences
          .map((te, i) => (
            <div
              key={`t-${i}`}
              style={{
                position: "absolute",
                bottom: 0,
                left: `${(te.t / duration) * 100}%`,
                width: 1,
                height: 4,
                background: "rgba(5,150,105,0.35)",
                pointerEvents: "none",
              }}
            />
          ))}

        {/* Scrubber input — sits on top, transparent hit area */}
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

        {/* Playhead — rendered on top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${progress}%`,
            width: 2,
            background: "var(--green)",
            boxShadow: "var(--green-glow)",
            pointerEvents: "none",
            zIndex: 5,
          }}
        />
      </div>

      {/* ── Controls row ───────────────────────────────── */}
      <div
        className="flex items-center gap-4 px-3"
        style={{ height: 36 }}
      >
        {/* Play/Pause */}
        <button
          onClick={() => {
            if (!playing && playbackT >= duration) setPlaybackT(0);
            setPlaying(!playing);
          }}
          style={{
            width: 26,
            height: 26,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--green-dim)",
            border: "1px solid rgba(5,150,105,0.2)",
            borderRadius: 2,
            cursor: "pointer",
            color: "var(--green)",
            flexShrink: 0,
          }}
        >
          {playing ? (
            /* Pause icon */
            <svg width="9" height="10" viewBox="0 0 9 10" fill="currentColor">
              <rect x="0" y="0" width="3" height="10"/>
              <rect x="6" y="0" width="3" height="10"/>
            </svg>
          ) : (
            /* Play icon */
            <svg width="9" height="10" viewBox="0 0 9 10" fill="currentColor">
              <path d="M0 0 L9 5 L0 10 Z"/>
            </svg>
          )}
        </button>

        {/* Speed selector */}
        <div className="flex items-center gap-px">
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              style={{
                fontFamily: "var(--mono)",
                fontSize: 9,
                letterSpacing: "0.04em",
                padding: "2px 7px",
                border: "1px solid",
                borderRadius: 1,
                cursor: "pointer",
                transition: "all 0.1s",
                borderColor: speed === s ? "rgba(5,150,105,0.3)" : "var(--border-hi)",
                background: speed === s ? "var(--green-dim)" : "transparent",
                color: speed === s ? "var(--green)" : "var(--text-dim)",
              }}
            >
              {s}×
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Time display */}
        <div className="flex items-baseline gap-1">
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 14,
              fontWeight: 300,
              letterSpacing: "0.04em",
              color: "var(--text)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatTime(playbackT)}
          </span>
          <span style={{ color: "var(--text-dim)", fontSize: 10 }}>/</span>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
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
