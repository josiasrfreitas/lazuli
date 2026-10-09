"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@lazuli/ui";

import { authClient } from "~/lib/auth-client";

/** Lets signed-in staff leave an account that cannot access the product. */
export function SignOutButton(): ReactNode {
  const [signingOut, setSigningOut] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut(): Promise<void> {
    setSigningOut(true);
    setFailed(false);
    try {
      const result = await authClient.signOut();
      if (result.error !== null) {
        setFailed(true);
        setSigningOut(false);
        return;
      }
      window.location.replace("/login");
    } catch {
      setFailed(true);
      setSigningOut(false);
    }
  }

  return (
    <div>
      <Button loading={signingOut} onClick={() => void signOut()} size="lg" variant="secondary">
        Sair
      </Button>
      {failed && (
        <p className="mt-2 text-caption text-marquee-muted" role="alert">
          Não foi possível sair. Tente novamente.
        </p>
      )}
    </div>
  );
}
