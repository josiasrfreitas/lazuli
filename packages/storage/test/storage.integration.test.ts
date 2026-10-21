import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { it } from "node:test";
import { createStorage } from "../src/storage.js";

void it("retries local bucket preparation and transfers private file bytes through the real S3 adapter", async () => {
  const objects = new Map<string, { bytes: Buffer; contentType: string }>();
  let bucketAttempts = 0;
  const server = createServer((request, response) => {
    void respond(request, response).catch((error) => {
      response.destroy(error instanceof Error ? error : new Error("S3 fixture failed"));
    });
  });
  async function respond(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const path = new URL(request.url!, "http://localhost").pathname;
    if (request.method === "PUT" && path.replace(/\/$/u, "") === "/isolated-test") {
      bucketAttempts += 1;
      const code = bucketAttempts === 1 ? "ServiceUnavailable" : "BucketAlreadyOwnedByYou";
      response.writeHead(bucketAttempts === 1 ? 503 : 409, { "content-type": "application/xml" });
      response.end(`<Error><Code>${code}</Code><Message>${code}</Message></Error>`);
      return;
    }
    if (request.method === "PUT") {
      const chunks: Buffer[] = [];
      for await (const chunk of request as AsyncIterable<Uint8Array>)
        chunks.push(Buffer.from(chunk));
      objects.set(path, {
        bytes: Buffer.concat(chunks),
        contentType: request.headers["content-type"] ?? "application/octet-stream",
      });
      response.writeHead(200);
      response.end();
      return;
    }
    if (request.method === "DELETE") {
      objects.delete(path);
      response.writeHead(204);
      response.end();
      return;
    }
    const object = objects.get(path);
    if (!object) {
      response.writeHead(404, { "content-type": "application/xml" });
      response.end("<Error><Code>NoSuchKey</Code><Message>Missing file</Message></Error>");
      return;
    }
    response.writeHead(200, {
      "content-type": object.contentType,
      "content-length": object.bytes.length,
    });
    response.end(object.bytes);
  }
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const storage = createStorage({
    bucket: "isolated-test",
    createLocalBucket: true,
    client: {
      endpoint: `http://127.0.0.1:${address.port}`,
      region: "us-east-1",
      credentials: { accessKeyId: "local", secretAccessKey: "local" },
      forcePathStyle: true,
      maxAttempts: 1,
    },
  });
  const file = {
    key: "private/original.bin",
    bytes: Uint8Array.of(0, 255, 65),
    contentType: "application/pdf",
  };
  try {
    await assert.rejects(storage.put(file), { name: "ServiceUnavailable" });
    assert.equal(objects.size, 0);
    const reference = await storage.put(file);
    assert.deepEqual(reference, { bucket: "isolated-test", key: "private/original.bin" });
    assert.deepEqual(await storage.read(reference), {
      bytes: Uint8Array.of(0, 255, 65),
      contentType: "application/pdf",
    });
    await storage.put({ ...file, key: "private/corrected.bin" });
    assert.equal(bucketAttempts, 2, "successful/existing bucket preparation must be cached");
    await storage.remove(reference);
    await assert.rejects(storage.read(reference), { name: "NoSuchKey" });
    assert.deepEqual(await storage.read({ ...reference, key: "private/corrected.bin" }), {
      bytes: Uint8Array.of(0, 255, 65),
      contentType: "application/pdf",
    });
    await assert.rejects(storage.put({ ...file, key: "" }), /bucket and object key/u);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
