import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

interface WsClient {
  ws: WebSocket;
  role: "capture" | "viewer" | null;
  sessionId?: string;
}

const clients = new Set<WsClient>();

export function getClientStatus() {
  return Array.from(clients).map((c) => ({
    role: c.role,
    sessionId: c.sessionId,
    readyState: c.ws.readyState,
  }));
}

export function setupWss(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    const client: WsClient = { ws, role: null };
    clients.add(client);
    console.log(`[ws] raw connection (${clients.size} total)`);

    ws.on("message", (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      if (msg.type === "identify") {
        client.role = msg.role as "capture" | "viewer";
        client.sessionId = msg.sessionId as string | undefined;
        console.log(`[ws] identified role=${client.role} sessionId=${client.sessionId ?? "—"}`);
        ws.send(JSON.stringify({ type: "ack" }));
        return;
      }

      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      // Fan out capture batches to all viewers
      if (client.role === "capture") {
        let sent = 0;
        for (const c of clients) {
          if (c.role === "viewer" && c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(raw);
            sent++;
          }
        }
        // Log first batch only (avoid log spam)
        if (client.sessionId && sent > 0) {
          const m = msg as { pose?: unknown[] };
          if (m.pose && Array.isArray(m.pose) && m.pose.length > 0) {
            console.log(`[ws] first batch relayed to ${sent} viewer(s)`);
            client.sessionId = undefined; // suppress future logs
          }
        }
      }
    });

    ws.on("close", () => {
      console.log(`[ws] disconnected role=${client.role ?? "unidentified"}`);
      clients.delete(client);
    });
    ws.on("error", () => clients.delete(client));
  });

  return wss;
}
