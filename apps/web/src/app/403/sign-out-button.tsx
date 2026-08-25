"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button } from "@lazuli/ui";

import { marqueeQuietActionClass } from "~/components/marquee/marquee-layout";
import { authClient } from "~/lib/auth-client";

/**
 * The only way out of a session, for now. It lives on the 403 page because that
 * is where a signed-in person can be stuck: the authenticated shell will grow
 * its own sign-out menu, and this button goes away when it does.
 */
export function SignOutButton(): ReactNode {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut(): Promise<void> {
    setSigningOut(true);
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      className={marqueeQuietActionClass}
      loading={signingOut}
      onClick={() => void signOut()}
      variant="secondary"
    >
      Sair
    </Button>
  );
}
