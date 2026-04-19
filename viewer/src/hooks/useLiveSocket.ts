import { useEffect, useRef, useState } from "react";
import { useSessionStore } from "../state/session";

interface BatchMessage {
  type: "batch";
  sessionId?: string;
  pose?: unknown[];
  imu?: unknown[];
  touches?: unknown[];
}

function isBatchMessage(data: unknown): data is BatchMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Record<string, unknown>).type === "batch"
  );
}

export function useLiveSocket(): { connected: boolean; batchCount: number } {
  const [connected, setConnected] = useState(false);
  const [batchCount, setBatchCount] = useState(0);
  const pushLiveBatch = useSessionStore((s) => s.pushLiveBatch);
  const pushRef = useRef(pushLiveBatch);
  pushRef.current = pushLiveBatch;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let attempt = 0;
    let unmounted = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (unmounted) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/ws`;
      ws = new WebSocket(url);

      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
        ws?.send(JSON.stringify({ type: "identify", role: "viewer" }));
      };

      ws.onmessage = (ev) => {
        try {
          const msg: unknown = JSON.parse(ev.data as string);
          if (isBatchMessage(msg)) {
            setBatchCount((n) => n + 1);
            pushRef.current({
              sessionId: msg.sessionId,
              pose: msg.pose as Parameters<typeof pushRef.current>[0]["pose"],
              imu: msg.imu as Parameters<typeof pushRef.current>[0]["imu"],
              touches: msg.touches as Parameters<
                typeof pushRef.current
              >[0]["touches"],
            });
          }
          // ignore ack/pong
        } catch {
          // ignore unparseable
        }
      };

      ws.onclose = () => {
        setConnected(false);
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws?.close();
      };
    }

    function scheduleReconnect() {
      if (unmounted) return;
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      attempt++;
      reconnectTimer = setTimeout(connect, delay);
    }

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimer != null) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  return { connected, batchCount };
}
