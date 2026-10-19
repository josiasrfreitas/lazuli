"use client";

import { Check, GraduationCap, LogOut, Shield } from "lucide-react";
import type { StaffIdentity, StaffRole } from "@lazuli/auth/server";
import { STAFF_ROLE_COOKIE } from "@lazuli/auth/roles";
import { Avatar, Button, Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@lazuli/ui";
import { useSignOut } from "~/lib/use-sign-out";

export function AccountMenu({ identity }: { identity: StaffIdentity }) {
  const { pending, failed, signOut } = useSignOut();
  const roles = identity.roles ?? [identity.role];
  function selectRole(role: StaffRole) {
    if (role === identity.role) return;
    document.cookie = `${STAFF_ROLE_COOKIE}=${role}; Path=/; Max-Age=2592000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    window.location.assign(role === "TEACHER" ? "/professor" : "/");
  }
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Conta de ${identity.name}`}
        render={<Button variant="ghost" size="icon" />}
      >
        <Avatar colorKey={identity.id} name={identity.name} />
      </PopoverTrigger>
      <PopoverContent align="end" size="md">
        <PopoverTitle>{identity.name}</PopoverTitle>
        <p className="mt-1 break-all text-caption text-muted-foreground">{identity.email}</p>
        <div className="mt-4 grid gap-1" aria-label="Escolher experiência">
          {roles.map((role) => (
            <Button
              key={role}
              variant={role === identity.role ? "secondary" : "ghost"}
              aria-pressed={role === identity.role}
              onClick={() => selectRole(role)}
            >
              {role === "TEACHER" ? <GraduationCap /> : <Shield />}
              {role === "TEACHER" ? "Professor" : "Administração"}
              {role === identity.role && <Check className="ml-auto" />}
            </Button>
          ))}
        </div>
        <div className="mt-3 border-t border-border pt-3">
          <Button variant="ghost" loading={pending} onClick={() => void signOut()}>
            <LogOut />
            Sair da conta
          </Button>
          {failed && (
            <p role="alert" className="text-caption text-destructive">
              Não foi possível sair. Tente novamente.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
