"use client";

import type { ReactNode } from "react";

import { Button } from "@lazuli/ui";

import { useSignOut } from "~/lib/use-sign-out";

/** Lets signed-in staff leave an account that cannot access the product. */
export function SignOutButton(): ReactNode {
  const { pending, failed, signOut } = useSignOut();

  return (
    <div>
      <Button loading={pending} onClick={() => void signOut()} size="lg" variant="secondary">
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
