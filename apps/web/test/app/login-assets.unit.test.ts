import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import { waitForLoginAssets } from "../../src/app/login/login-assets.js";

function deferred(): { promise: Promise<void>; resolve: () => void; reject: () => void } {
  let resolve!: () => void;
  let reject!: () => void;
  const promise = new Promise<void>((accept, fail) => {
    resolve = accept;
    reject = () => fail(new Error("Image unavailable"));
  });
  return { promise, resolve, reject };
}

void test("the login waits for image decoding AND fonts, including cached images", async (context) => {
  const photo = deferred();
  const fonts = deferred();
  const image = { dataset: {} as DOMStringMap, complete: true, decode: () => photo.promise };
  mockFonts(context, fonts.promise);
  let ready = false;
  const completion = waitForLoginAssets([image], new AbortController().signal).then(() => {
    ready = true;
  });
  await Promise.resolve();
  assert.equal(ready, false);
  assert.equal(image.dataset.assetPending, "true");
  photo.resolve();
  await Promise.resolve();
  assert.equal(image.dataset.assetPending, undefined);
  assert.equal(ready, false);
  fonts.resolve();
  await completion;
  assert.equal(ready, true);
});

void test("a failed image stays hidden but does not block the form", async (context) => {
  const photo = deferred();
  const image = { dataset: {} as DOMStringMap, decode: () => photo.promise };
  mockFonts(context, Promise.resolve());
  const completion = waitForLoginAssets([image], new AbortController().signal);
  photo.reject();
  await completion;
  assert.equal(image.dataset.assetPending, "true");
});

void test("a stalled asset releases access at the deadline and appears only once decoded", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const photo = deferred();
  const image = { dataset: {} as DOMStringMap, decode: () => photo.promise };
  mockFonts(context, Promise.resolve());
  const completion = waitForLoginAssets([image], new AbortController().signal);
  context.mock.timers.tick(10_000);
  await completion;
  assert.equal(image.dataset.assetPending, "true");
  photo.resolve();
  await Promise.resolve();
  assert.equal(image.dataset.assetPending, undefined);
});

void test("unmounting releases the wait without mutating detached images", async (context) => {
  const photo = deferred();
  const image = { dataset: {} as DOMStringMap, decode: () => photo.promise };
  mockFonts(context, Promise.resolve());
  const controller = new AbortController();
  const completion = waitForLoginAssets([image], controller.signal);
  controller.abort();
  await completion;
  photo.resolve();
  await Promise.resolve();
  assert.equal(image.dataset.assetPending, "true");
});

function mockFonts(context: TestContext, ready: Promise<void>): void {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { fonts: { ready } },
  });
  context.after(() => {
    Reflect.deleteProperty(globalThis, "document");
  });
}
