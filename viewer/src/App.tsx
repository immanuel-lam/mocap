import { useRef } from "react";
import { useSessionStore } from "./state/session";
import { useLiveSocket } from "./hooks/useLiveSocket";
import { LiveMode } from "./modes/LiveMode";
import { ReplayMode } from "./modes/ReplayMode";
import { CameraFollowToggle } from "./ui/CameraFollowToggle";
import { SessionPicker } from "./ui/SessionPicker";

/** Injects a spinning pose batch every 16ms to test the viewer without hardware. */
function useSimulator() {
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const simAngle = useRef(0);
  const pushLiveBatch = useSessionStore((s) => s.pushLiveBatch);

  function startSim() {
    if (simTimer.current) return;
    simTimer.current = setInterval(() => {
      simAngle.current += 0.03;
      const a = simAngle.current;
      const qy = Math.sin(a / 2);
      const qw = Math.cos(a / 2);
      pushLiveBatch({
        pose: [{
          t: performance.now(),
          p: [0, 0, 0],
          q: [0, qy, 0, qw],
          tracking: "normal",
        }],
      });
    }, 16);
  }

  function stopSim() {
    if (simTimer.current) {
      clearInterval(simTimer.current);
      simTimer.current = null;
    }
    useSessionStore.getState().pushLiveBatch({ pose: [] });
  }

  return { startSim, stopSim };
}

export default function App() {
  const { connected, batchCount } = useLiveSocket();
  const mode = useSessionStore((s) => s.mode);
  const setMode = useSessionStore((s) => s.setMode);
  const { startSim, stopSim } = useSimulator();
  const simRunning = useRef(false);

  return (
    <div className="flex flex-col h-full w-full" style={{ background: "var(--bg)" }}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <header
        className="flex items-center shrink-0 px-3"
        style={{
          height: 34,
          background: "var(--panel)",
          borderBottom: "1px solid var(--border)",
          gap: 0,
        }}
      >
        {/* Wordmark */}
        <span
          style={{
            fontFamily: "var(--cond)",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.22em",
            color: "var(--text-mid)",
            textTransform: "uppercase",
            paddingRight: 16,
          }}
        >
          MoCap
        </span>

        {/* Mode tabs */}
        <div
          className="flex items-stretch h-full"
          style={{ gap: 1, marginRight: "auto" }}
        >
          {(["live", "replay"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                fontFamily: "var(--cond)",
                fontWeight: 600,
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                padding: "0 14px",
                border: "none",
                borderBottom: mode === m
                  ? "2px solid var(--amber)"
                  : "2px solid transparent",
                cursor: "pointer",
                background: "transparent",
                color: mode === m ? "var(--amber)" : "var(--text-dim)",
                transition: "color 0.1s, border-color 0.1s",
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Right cluster */}
        <div className="flex items-center" style={{ gap: 12 }}>

          {/* Connection */}
          <div className="flex items-center" style={{ gap: 6 }}>
            <span
              className={connected ? "led-live" : ""}
              style={{
                display: "inline-block",
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: connected ? "var(--green)" : "var(--text-dim)",
              }}
            />
            <span
              style={{
                fontFamily: "var(--cond)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: connected ? "var(--green)" : "var(--text-dim)",
              }}
            >
              {connected ? "Live" : "Offline"}
            </span>
            {batchCount > 0 && (
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  color: "var(--amber)",
                  letterSpacing: "0.04em",
                }}
              >
                {batchCount}▲
              </span>
            )}
          </div>

          <span style={{ width: 1, height: 12, background: "var(--border-hi)" }} />

          {/* SIM */}
          <button
            onClick={() => {
              simRunning.current = !simRunning.current;
              simRunning.current ? startSim() : stopSim();
            }}
            style={{
              fontFamily: "var(--cond)",
              fontWeight: 600,
              fontSize: 9,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              padding: "2px 8px",
              border: "1px solid var(--border-hi)",
              cursor: "pointer",
              background: "transparent",
              color: "var(--text-dim)",
              transition: "color 0.1s, border-color 0.1s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--amber)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--amber)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--text-dim)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hi)";
            }}
          >
            Sim
          </button>

          <span style={{ width: 1, height: 12, background: "var(--border-hi)" }} />

          <CameraFollowToggle />
        </div>
      </header>

      {/* ── Main area ───────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside
          className="shrink-0 flex flex-col overflow-hidden"
          style={{
            width: 192,
            borderRight: "1px solid var(--border)",
            background: "var(--panel)",
          }}
        >
          <SessionPicker />
        </aside>

        {/* Viewport */}
        <main className="flex-1 min-w-0 viewport-wrap">
          {mode === "live" ? <LiveMode /> : <ReplayMode />}
        </main>
      </div>
    </div>
  );
}
