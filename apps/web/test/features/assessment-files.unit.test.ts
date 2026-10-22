import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileBase64 } from "../../src/features/assessment-files/file-transfer.js";
import { readPendingFiles } from "../../src/features/assessment-files/local-queue.js";

function restoreGlobal(name: "FileReader" | "indexedDB", original?: PropertyDescriptor): void {
  if (original) Object.defineProperty(globalThis, name, original);
  else Reflect.deleteProperty(globalThis, name);
}

void test("reads the browser data URL and rejects a missing FileReader result", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "FileReader");
  let nextResult: string | null = "data:text/plain;base64,YWJj";
  class FakeReader extends EventTarget {
    result = nextResult;
    readAsDataURL(): void {
      queueMicrotask(() => this.dispatchEvent(new Event("load")));
    }
  }
  Object.defineProperty(globalThis, "FileReader", { configurable: true, value: FakeReader });
  try {
    const file = new File(["abc"], "example.txt", { type: "text/plain" });
    assert.equal(await readFileBase64(file), "YWJj");
    nextResult = null;
    await assert.rejects(readFileBase64(file), /Não foi possível ler o arquivo/u);
  } finally {
    restoreGlobal("FileReader", original);
  }
});

void test("reports an IndexedDB read failure as an Error even without a browser error object", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  let closed = false;
  const failedRead = new EventTarget();
  const db = {
    transaction: () => ({
      objectStore: () => ({
        getAll: () => {
          queueMicrotask(() => failedRead.dispatchEvent(new Event("error")));
          return failedRead;
        },
      }),
    }),
    close: () => {
      closed = true;
    },
  };
  const opened = Object.assign(new EventTarget(), {
    result: db,
    onsuccess: null as (() => void) | null,
    onupgradeneeded: null as (() => void) | null,
  });
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: {
      open: () => {
        queueMicrotask(() => opened.onsuccess?.());
        return opened;
      },
    },
  });
  try {
    await assert.rejects(readPendingFiles("staff-1"), {
      name: "Error",
      message: "Não foi possível ler os arquivos pendentes.",
    });
    assert.equal(closed, true);
  } finally {
    restoreGlobal("indexedDB", original);
  }
});
