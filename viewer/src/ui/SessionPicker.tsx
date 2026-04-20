import { useCallback, useEffect, useState } from "react";
import { useSessionStore } from "../state/session";
import type { Session } from "../state/session";

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

export function SessionPicker() {
  const [sessions, setSessions] = useState<{ id: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setReplaySession = useSessionStore((s) => s.setReplaySession);
  const setMode = useSessionStore((s) => s.setMode);
  const replaySession = useSessionStore((s) => s.replaySession);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/sessions");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: string[] = await res.json();
      setSessions(data.map((id) => ({ id })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteSession = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/sessions/${id}`, { method: "DELETE" });
    if (replaySession?.id === id) setReplaySession(null);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, [replaySession, setReplaySession]);

  const clearAll = useCallback(async () => {
    if (!confirm(`Delete all ${sessions.length} sessions?`)) return;
    await fetch("/sessions", { method: "DELETE" });
    setReplaySession(null);
    setSessions([]);
  }, [sessions.length, setReplaySession]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const loadSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/sessions/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const session: Session = await res.json();
      setReplaySession(session);
      setMode("replay");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [setReplaySession, setMode]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3"
        style={{
          height: 30,
          borderBottom: "1px solid var(--border)",
          background: "var(--panel-2)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "var(--cond)",
            fontWeight: 700,
            fontSize: 9,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--text-dim)",
          }}
        >
          Sessions
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchSessions}
            disabled={loading}
            style={{
              fontFamily: "var(--cond)",
              fontWeight: 600,
              fontSize: 9,
              color: loading ? "var(--text-dim)" : "var(--text-mid)",
              background: "none",
              border: "none",
              padding: "2px 4px",
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "···" : "↺"}
          </button>
          {sessions.length > 0 && (
            <button
              onClick={clearAll}
              style={{
                fontFamily: "var(--cond)",
                fontWeight: 600,
                fontSize: 9,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--red)",
                background: "none",
                border: "none",
                padding: "2px 4px",
                cursor: "pointer",
                opacity: 0.6,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.6"; }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="px-3 py-1"
          style={{ color: "var(--red)", fontFamily: "var(--mono)", fontSize: 9, opacity: 0.8 }}
        >
          {error}
        </div>
      )}

      {/* List */}
      <div className="flex flex-col overflow-y-auto flex-1">
        {sessions.length === 0 && !loading && (
          <div
            className="flex-1 flex flex-col items-center justify-center gap-2"
            style={{ color: "var(--text-dim)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.3 }}>
              <rect x="3" y="6" width="18" height="14" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M3 10h18" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <span style={{
              fontFamily: "var(--cond)", fontSize: 9,
              letterSpacing: "0.14em", textTransform: "uppercase",
            }}>
              No recordings
            </span>
          </div>
        )}

        {sessions.map((s, i) => {
          const isActive = replaySession?.id === s.id;
          return (
            <button
              key={s.id}
              onClick={() => loadSession(s.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 10px",
                height: 30,
                borderBottom: "1px solid var(--border)",
                background: isActive ? "var(--amber-dim)" : "transparent",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 3,
                  height: 3,
                  borderRadius: "50%",
                  background: isActive ? "var(--amber)" : "var(--border-hi)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  color: isActive ? "var(--amber)" : "var(--text)",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {shortId(s.id)}
              </span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 8,
                  color: "var(--text-dim)",
                  flexShrink: 0,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <button
                onClick={(e) => deleteSession(s.id, e)}
                style={{
                  background: "none",
                  border: "none",
                  padding: "0 2px",
                  cursor: "pointer",
                  color: "var(--text-dim)",
                  fontSize: 10,
                  lineHeight: 1,
                  opacity: 0.4,
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = "1";
                  (e.currentTarget as HTMLElement).style.color = "var(--red)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = "0.4";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-dim)";
                }}
              >
                ✕
              </button>
            </button>
          );
        })}
      </div>
    </div>
  );
}
