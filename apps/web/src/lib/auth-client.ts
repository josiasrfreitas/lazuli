"use client";

import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * The browser half of Better Auth, and the only place the app creates it. The
 * server half lives in `@lazuli/auth/server`, which no client component imports.
 *
 * `baseURL` is deliberately left out: the client then calls `/api/auth` on
 * whatever origin served the page, so previews and local ports work unchanged.
 */
export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});
