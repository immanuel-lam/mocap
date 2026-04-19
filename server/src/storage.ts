import fs from "fs";
import path from "path";

const SESSIONS_DIR = path.join(process.cwd(), "sessions");

export function ensureSessionsDir(): void {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

export function listSessions(): string[] {
  if (!fs.existsSync(SESSIONS_DIR)) return [];
  return fs
    .readdirSync(SESSIONS_DIR)
    .filter((f) => fs.statSync(path.join(SESSIONS_DIR, f)).isDirectory());
}

export function saveSession(
  id: string,
  json: Buffer,
  videoBuffer?: Buffer,
  videoExt?: string
): void {
  const dir = path.join(SESSIONS_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "session.json"), json);
  if (videoBuffer && videoExt) {
    fs.writeFileSync(path.join(dir, `video.${videoExt}`), videoBuffer);
  }
}

export function getSessionJson(id: string): Buffer | null {
  const p = path.join(SESSIONS_DIR, id, "session.json");
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p);
}

export function deleteSession(id: string): void {
  const dir = path.join(SESSIONS_DIR, id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

export function clearAllSessions(): number {
  const ids = listSessions();
  ids.forEach((id) => deleteSession(id));
  return ids.length;
}

export function getSessionVideoPath(id: string): string | null {
  const dir = path.join(SESSIONS_DIR, id);
  for (const ext of ["mp4", "mov"]) {
    const p = path.join(dir, `video.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
