import assert from "node:assert/strict";
import { afterEach, it } from "node:test";
import { TRPCError } from "@trpc/server";
import { setErrorReporter } from "@lazuli/logging";
import { createCallerFactory, publicProcedure, router } from "../../src/trpc/init.js";
import type { Context } from "../../src/trpc/context.js";

afterEach(() => setErrorReporter(undefined));
const context: Context = { db: {} as Context["db"], staffUser: null };
void it("captures the real exception returned by tRPC middleware even when next does not throw", async () => {
  const original = new TypeError("Teaching schedule storage unavailable");
  const received: Error[] = [];
  setErrorReporter((error) => {
    received.push(error);
  });
  const caller = createCallerFactory(
    router({
      failure: publicProcedure.query(() => {
        throw original;
      }),
    }),
  )(context);
  await assert.rejects(
    caller.failure(),
    (error) => error instanceof TRPCError && error.cause === original,
  );
  assert.deepEqual(received, [original]);
  assert.equal(received[0]?.stack, original.stack);
});
void it("keeps authorization and business rejections out of exception monitoring", async () => {
  const received: Error[] = [];
  setErrorReporter((error) => {
    received.push(error);
  });
  const caller = createCallerFactory(
    router({
      reject: publicProcedure.query(() => {
        throw new TRPCError({ code: "FORBIDDEN", message: "Role does not allow this operation" });
      }),
    }),
  )(context);
  await assert.rejects(
    caller.reject(),
    (error) => error instanceof TRPCError && error.code === "FORBIDDEN",
  );
  assert.deepEqual(received, []);
});

void it("returns a retryable timeout for expired transactions and preserves other transaction failures", async () => {
  const received: Error[] = [];
  setErrorReporter((error) => received.push(error));
  const expired = Object.assign(
    new Error("A query cannot be executed on an expired transaction."),
    { code: "P2028" },
  );
  const other = Object.assign(new Error("Transaction not found."), { code: "P2028" });
  const caller = createCallerFactory(
    router({
      expired: publicProcedure.mutation(() => {
        throw expired;
      }),
      other: publicProcedure.mutation(() => {
        throw other;
      }),
    }),
  )(context);
  await assert.rejects(
    caller.expired(),
    (error) => error instanceof TRPCError && error.code === "TIMEOUT" && error.cause === expired,
  );
  await assert.rejects(
    caller.other(),
    (error) => error instanceof TRPCError && error.code === "INTERNAL_SERVER_ERROR",
  );
  assert.deepEqual(received, [other]);
});
