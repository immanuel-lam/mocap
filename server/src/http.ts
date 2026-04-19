import express, { type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import {
  ensureSessionsDir,
  listSessions,
  saveSession,
  getSessionJson,
  getSessionVideoPath,
} from "./storage";
import { getClientStatus } from "./ws";

const upload = multer({ storage: multer.memoryStorage() });

export function setupHttp(app: express.Application): void {
  ensureSessionsDir();

  // Upload session (+ optional video)
  app.post(
    "/sessions",
    upload.fields([{ name: "session" }, { name: "video" }]),
    (req: Request, res: Response) => {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const sessionFile = files?.session?.[0];
      if (!sessionFile) {
        res.status(400).json({ error: "missing session file" });
        return;
      }

      let parsed: { id?: string };
      try {
        parsed = JSON.parse(sessionFile.buffer.toString()) as { id?: string };
      } catch {
        res.status(400).json({ error: "invalid JSON" });
        return;
      }

      const { id } = parsed;
      if (!id) {
        res.status(400).json({ error: "missing id" });
        return;
      }

      const videoFile = files?.video?.[0];
      const videoExt =
        videoFile?.mimetype === "video/mp4"
          ? "mp4"
          : videoFile
          ? "mov"
          : undefined;

      saveSession(id, sessionFile.buffer, videoFile?.buffer, videoExt);
      console.log(`[http] saved session ${id}`);
      res.json({ id });
    }
  );

  // Debug: who is connected?
  app.get("/debug/ws", (_req: Request, res: Response) => {
    res.json(getClientStatus());
  });

  // List sessions
  app.get("/sessions", (_req: Request, res: Response) => {
    res.json(listSessions());
  });

  // Get session JSON
  app.get("/sessions/:id", (req: Request, res: Response) => {
    const buf = getSessionJson(req.params.id);
    if (!buf) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.send(buf);
  });

  // Stream video
  app.get("/sessions/:id/video", (req: Request, res: Response) => {
    const videoPath = getSessionVideoPath(req.params.id);
    if (!videoPath) {
      res.status(404).json({ error: "no video" });
      return;
    }
    res.sendFile(path.resolve(videoPath));
  });
}
