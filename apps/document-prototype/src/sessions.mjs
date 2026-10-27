import { randomBytes } from "node:crypto";

export const MAX_BYTES = 5 * 1024 * 1024;

// Ephemeral capabilities, never student records. Restart invalidates every link.
export function createSessions() {
  const sessions = new Map();
  return {
    issue() {
      if (sessions.size >= 10) throw new Error("Too many active sessions");
      const token = randomBytes(32).toString("base64url");
      const session = { expiresAt: null, attempts: 0, status: "idle", result: null, documents: {} };
      sessions.set(token, session);
      return { token, expiresAt: session.expiresAt };
    },
    get(token) {
      return sessions.get(token);
    },
  };
}
