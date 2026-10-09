"use client";

import { useEffect } from "react";

import { authClient } from "~/lib/auth-client";
import { sessionRedirect } from "~/lib/session-sync";

/** Mounts Better Auth's cross-tab session listener on authenticated screens. */
export function SessionSync({ renderedEmail }: { renderedEmail: string }): null {
  const { data: session, isPending, error } = authClient.useSession();

  useEffect(() => {
    const destination = sessionRedirect({
      renderedEmail,
      currentEmail: session?.user.email ?? null,
      isPending,
      hasError: error !== null,
    });
    if (destination !== null) {
      // A full navigation also discards the previous account's client-side cache.
      globalThis.location.replace(destination);
    }
  }, [session, isPending, error, renderedEmail]);

  return null;
}
