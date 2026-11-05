import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";

import { proxy } from "../src/proxy.js";

void describe("request context proxy", () => {
  void it("replaces an incoming ID and forwards one ID to the API and response", () => {
    const request = new NextRequest("http://localhost/api/trpc/students.list", {
      headers: { "x-request-id": "untrusted" },
    });
    const response = proxy(request);
    const requestId = response.headers.get("x-request-id");
    assert.match(requestId ?? "", /^[0-9a-f-]{36}$/u);
    assert.notEqual(requestId, "untrusted");
    assert.equal(response.headers.get("x-middleware-request-x-request-id"), requestId);
    assert.equal(response.headers.get("x-middleware-request-x-lazuli-page-url"), null);
  });

  void it("keeps the page destination while forwarding the same ID", () => {
    const response = proxy(new NextRequest("http://localhost/alunos?pagina=2&_rsc=abc"));
    assert.equal(
      response.headers.get("x-middleware-request-x-lazuli-page-url"),
      "/alunos?pagina=2",
    );
    assert.equal(
      response.headers.get("x-middleware-request-x-request-id"),
      response.headers.get("x-request-id"),
    );
  });
});
