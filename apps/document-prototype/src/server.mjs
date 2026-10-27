import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";
import { Worker } from "node:worker_threads";
import { createSessions, MAX_BYTES } from "./sessions.mjs";

import { documentFor, sessionSummary } from "./documents.mjs";

const prefix = "/document-prototype";
const root = new URL("./", import.meta.url);
const sessions = createSessions();
const adminSecret = process.env.PROTOTYPE_ADMIN_SECRET;
if (!adminSecret || adminSecret.length < 32)
  throw new Error("PROTOTYPE_ADMIN_SECRET must contain at least 32 characters");
if (process.env.LAZULI_ENV !== "staging" && process.env.LAZULI_ENV !== "local")
  throw new Error("Prototype is restricted to staging/local");
function send(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}
function authorizedAdmin(request) {
  const supplied = Buffer.from(request.headers["x-prototype-admin"] ?? "");
  const expected = Buffer.from(adminSecret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
async function readImage(request) {
  if (request.headers["content-type"] !== "image/jpeg") throw new Error("IMAGE_TYPE");
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_BYTES) throw new Error("IMAGE_SIZE");
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (bytes.length < 3 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255)
    throw new Error("IMAGE_TYPE");
  return bytes;
}
const server = createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  );
  const path = new URL(request.url, "http://localhost").pathname;
  try {
    if (path === `${prefix}/internal/sessions` && request.method === "POST") {
      if (!authorizedAdmin(request)) return send(response, 403, { code: "FORBIDDEN" });
      return send(response, 201, sessions.issue());
    }
    if (request.method === "GET" && (path === `${prefix}/` || path === prefix)) {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      return response.end(await readFile(new URL("index.html", root)));
    }
    if (request.method === "GET" && /^\/document-prototype\/assets\/[a-zA-Z0-9_.-]+$/.test(path)) {
      const name = path.split("/").at(-1);
      response.setHeader(
        "Content-Type",
        name.endsWith(".css")
          ? "text/css"
          : name.endsWith(".wasm")
            ? "application/wasm"
            : "text/javascript",
      );
      return response.end(await readFile(new URL(`assets/${name}`, root)));
    }
    const token = request.headers.authorization?.replace(/^Bearer /, "");
    const session = sessions.get(token);
    if (!session) return send(response, 410, { code: "EXPIRED" });
    if (path === `${prefix}/api/session` && request.method === "GET") {
      return send(response, 200, sessionSummary(session));
    }
    const documentMatch = path.match(
      /^\/document-prototype\/api\/documents\/(student|guardian|residence|payment)$/,
    );
    if (documentMatch) {
      const id = documentMatch[1];
      if (request.method === "GET") {
        const bytes = session.documents[id]?.bytes;
        if (!bytes) return send(response, 404, { code: "NOT_FOUND" });
        response.setHeader("Content-Type", "image/jpeg");
        return response.end(bytes);
      }
      if (request.method === "POST") {
        if (session.status === "working" || session.status === "uploading")
          return send(response, 409, { code: "BUSY" });
        session.status = "uploading";
        let bytes;
        try {
          bytes = await readImage(request);
        } catch {
          session.status = "idle";
          return send(response, 400, { code: "INVALID_IMAGE" });
        }
        const document = {
          bytes,
          revision: (session.documents[id]?.revision ?? 0) + 1,
          status: documentFor(id).extracts ? "working" : "done",
          result: null,
        };
        session.documents[id] = document;
        if (!documentFor(id).extracts) {
          session.status = "idle";
          return send(response, 201, { status: "done" });
        }
        session.status = "working";
        const worker = new Worker(fileURLToPath(new URL("ocr-worker.mjs", root)), {
          workerData: bytes,
        });
        session.worker = worker;
        worker.once("message", (message) => {
          Object.assign(document, message);
          session.status = "idle";
        });
        worker.once("error", () => {
          document.status = "error";
          document.code = "OCR_FAILED";
          session.status = "idle";
        });
        worker.once("exit", () => {
          if (document.status === "working") {
            document.status = "error";
            document.code = "OCR_FAILED";
          }
          session.status = "idle";
        });
        return send(response, 202, { status: "working" });
      }
    }

    if (path === `${prefix}/api/extract` && request.method === "POST") {
      if (session.status === "working" || session.status === "uploading")
        return send(response, 409, { code: "BUSY" });
      session.status = "uploading";
      let bytes;
      try {
        bytes = await readImage(request);
      } catch {
        session.status = "idle";
        return send(response, 400, { code: "INVALID_IMAGE" });
      }
      if (!sessions.get(token)) return send(response, 410, { code: "EXPIRED" });
      session.attempts += 1;
      session.status = "working";
      session.result = null;
      session.code = undefined;
      const worker = new Worker(fileURLToPath(new URL("ocr-worker.mjs", root)), {
        workerData: bytes,
      });
      session.worker = worker;
      worker.once("message", (message) => {
        if (sessions.get(token)) Object.assign(session, message);
      });
      worker.once("error", () => {
        session.status = "error";
        session.code = "OCR_FAILED";
      });
      worker.once("exit", () => {
        if (session.status === "working") {
          session.status = "error";
          session.code = "OCR_FAILED";
        }
      });
      return send(response, 202, { status: "working" });
    }
    send(response, 404, { code: "NOT_FOUND" });
  } catch {
    send(response, 500, { code: "UNAVAILABLE" });
  }
});
server.requestTimeout = 20_000;
server.listen(Number(process.env.PORT || 3099), process.env.HOST || "127.0.0.1", () =>
  console.log("Document prototype listening"),
);
