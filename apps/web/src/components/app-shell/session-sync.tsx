"use client";

import { useEffect } from "react";

import { authClient } from "~/lib/auth-client";

/** Mounts Better Auth's cross-tab session listener on authenticated screens. */
export function SessionSync(): null {
  const { data: session, isPending, error } = authClient.useSession();

  useEffect(() => {
    if (!isPending && error === null && session === null) {
      // A full navigation also discards the previous account's client-side cache.
      window.location.replace("/login");
    }
  }, [session, isPending, error]);

  return null;
}
