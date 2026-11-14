import assert from "node:assert/strict";
import { it } from "node:test";
import { captureFetch, sendCapture } from "../../src/features/mobile-upload/mobile-page.js";

void it("sends the selected file with capture authorization and encoded metadata", async (context) => {
  const calls: { endpoint: Parameters<typeof fetch>[0]; options: RequestInit | undefined }[] = [];
  context.mock.method(
    globalThis,
    "fetch",
    (endpoint: Parameters<typeof fetch>[0], options?: RequestInit) => {
      calls.push({ endpoint, options });
      return Promise.resolve(new Response(null, { status: 204 }));
    },
  );
  const file = new File(["document"], "diploma.pdf", { type: "application/pdf" });
  await sendCapture(
    { endpoint: "/api/teacher-capture", token: "capture-session" },
    {
      kind: "qualification",
      label: "Diploma",
      subtitle: "Licenciatura",
      file,
    },
  );
  assert.equal(calls.length, 1);
  const request = calls[0];
  assert.equal(request?.endpoint, "/api/teacher-capture");
  assert.equal(request?.options?.method, "POST");
  assert.equal(request?.options?.body, file);
  const headers = new Headers(request?.options?.headers);
  assert.equal(headers.get("Authorization"), "Bearer capture-session");
  assert.equal(headers.get("Content-Type"), "application/pdf");
  assert.deepEqual(JSON.parse(decodeURIComponent(headers.get("X-Upload-Metadata") ?? "")), {
    kind: "qualification",
    label: "Diploma",
    subtitle: "Licenciatura",
    fileName: "diploma.pdf",
    contentType: "application/pdf",
    byteLength: 8,
  });
});

void it("reports an expired capture session before attempting to parse an error body", async (context) => {
  context.mock.method(globalThis, "fetch", () =>
    Promise.resolve(new Response("expired", { status: 410 })),
  );
  await assert.rejects(captureFetch({ endpoint: "/api/teacher-capture", token: "expired" }), {
    message: "Sessão encerrada. Abra um novo QR code no cadastro.",
  });
});
