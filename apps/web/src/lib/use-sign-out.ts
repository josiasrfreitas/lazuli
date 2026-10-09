"use client";

import { useState } from "react";

import { authClient } from "~/lib/auth-client";

/** Clear the client document after logout, while retaining a retry on failure. */
export function useSignOut(): { pending: boolean; failed: boolean; signOut: () => Promise<void> } {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut(): Promise<void> {
    setPending(true);
    setFailed(false);
    try {
      const result = await authClient.signOut();
      if (result.error !== null) {
        setFailed(true);
        setPending(false);
        return;
      }
      globalThis.location.replace("/login");
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return { pending, failed, signOut };
}
