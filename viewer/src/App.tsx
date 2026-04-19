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
      // Slow spin around Y axis
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
    <div
      className="flex flex-col h-full w-full"
      style={{ background: "var(--bg)" }}
    >
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between shrink-0 px-4"
        style={{
          height: 38,
          background: "var(--panel)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Left: logo + mode tabs */}
        <div className="flex items-center gap-5">
          {/* Wordmark */}
          <span
            style={{
              fontFamily: "var(--cond)",
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: "0.18em",
              color: "var(--green)",
              textShadow: "var(--green-glow)",
              textTransform: "uppercase",
            }}
          >
            MoCap
          </span>

          {/* Divider */}
          <span style={{ width: 1, height: 18, background: "var(--border-hi)", display: "block" }} />

          {/* Mode tabs */}
          <div className="flex items-center gap-px" style={{ background: "var(--bg)", borderRadius: 3, padding: 2 }}>
            {(["live", "replay"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  fontFamily: "var(--cond)",
                  fontWeight: 600,
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  padding: "3px 12px",
                  borderRadius: 2,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: mode === m ? "var(--green-dim)" : "transparent",
                  color: mode === m ? "var(--green)" : "var(--text-mid)",
                  boxShadow: mode === m ? "inset 0 0 0 1px rgba(61,255,143,0.2)" : "none",
                  textShadow: mode === m ? "var(--green-glow)" : "none",
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Right: WS status + camera toggle */}
        <div className="flex items-center gap-4">
          {/* Connection LED */}
          <div className="flex items-center gap-2">
            <span
              className={connected ? "led-live" : ""}
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: connected ? "var(--green)" : "var(--text-dim)",
                boxShadow: connected ? "var(--green-glow)" : "none",
              }}
            />
            <span
              style={{
                fontFamily: "var(--cond)",
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: connected ? "var(--green)" : "var(--text-dim)",
              }}
            >
              {connected ? "Live" : "Offline"}
            </span>
            {batchCount > 0 && (
              <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--amber)", marginLeft: 2 }}>
                {batchCount}▲
              </span>
            )}
          </div>

          <span style={{ width: 1, height: 14, background: "var(--border-hi)", display: "block" }} />

          {/* Sim button — spins the model locally, no hardware needed */}
          <button
            onClick={() => {
              simRunning.current = !simRunning.current;
              simRunning.current ? startSim() : stopSim();
            }}
            style={{
              fontFamily: "var(--cond)",
              fontWeight: 600,
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "2px 8px",
              borderRadius: 2,
              border: "1px solid rgba(255,155,56,0.3)",
              cursor: "pointer",
              background: "transparent",
              color: "var(--amber)",
            }}
          >
            SIM
          </button>

          <span style={{ width: 1, height: 14, background: "var(--border-hi)", display: "block" }} />

          <CameraFollowToggle />
        </div>
      </header>

      {/* ── Main area ───────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside
          className="shrink-0 flex flex-col overflow-hidden"
          style={{
            width: 200,
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
