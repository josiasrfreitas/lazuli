"use client";

import { LogOut } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { StaffIdentity, StaffRole } from "@lazuli/auth/server";
import { Avatar, Button } from "@lazuli/ui";

import { authClient } from "~/lib/auth-client";

const ROLE_LABELS: Record<StaffRole, string> = {
  SYSTEM_ADMIN: "Administração do sistema",
  ADMIN: "Administração",
  SECRETARY: "Secretaria",
  TEACHER: "Professor",
  FINANCE: "Financeiro",
};

export function AccountFooter({ identity }: { identity: StaffIdentity }): ReactNode {
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
      window.location.replace("/login");
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <footer className="dark border-t border-navigation-border px-1.75 py-4">
      <div className="flex items-center gap-2">
        <Avatar colorKey={identity.id} name={identity.name} />
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:opacity-0 sm:transition-opacity sm:duration-200 sm:group-hover/sidebar:opacity-100 sm:group-has-[:focus-visible]/sidebar:opacity-100 motion-reduce:transition-none">
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-caption font-semibold text-navigation-foreground"
              title={identity.name}
            >
              {identity.name}
            </p>
            <p
              className="truncate text-micro text-navigation-muted"
              title={ROLE_LABELS[identity.role]}
            >
              {ROLE_LABELS[identity.role]}
            </p>
          </div>
          <Button
            aria-label="Sair da conta"
            title="Sair da conta"
            loading={pending}
            onClick={() => void signOut()}
            size="icon-compact-responsive"
            variant="ghost"
          >
            <LogOut aria-hidden="true" />
          </Button>
        </div>
      </div>
      {failed && (
        <p className="mt-2 text-caption text-navigation-foreground" role="alert">
          Não foi possível sair. Tente novamente.
        </p>
      )}
    </footer>
  );
}
