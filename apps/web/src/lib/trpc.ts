"use client";

import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@lazuli/api";

/**
 * The single import point for the tRPC client. Feature code talks to the BFF
 * through `trpc.*` hooks in a `logic.ts` module; nothing else imports
 * `@trpc/client` directly.
 *
 * `AppRouter` is a type-only import, so no server code reaches the browser bundle.
 * The endpoint stays relative: these hooks only fetch in the browser, where the
 * request lands on this app's own route handler.
 */

const TRPC_ENDPOINT = "/api/trpc";

export const trpc = createTRPCReact<AppRouter>();

export type TRPCClient = ReturnType<typeof trpc.createClient>;

export function createTRPCClient(): TRPCClient {
  return trpc.createClient({
    links: [httpBatchLink({ url: TRPC_ENDPOINT, transformer: superjson })],
  });
}
