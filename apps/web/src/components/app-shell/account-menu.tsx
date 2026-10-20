"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, GraduationCap, LogOut, Shield } from "lucide-react";
import type { StaffIdentity, StaffRole } from "@lazuli/auth/server";
import { Avatar, Button, Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@lazuli/ui";
import { activateExperience, experienceHome } from "~/lib/staff-experience";
import { useSignOut } from "~/lib/use-sign-out";
import styles from "./account-menu.module.css";

export function AccountMenu({ identity }: { identity: StaffIdentity }) {
  const { pending, failed, signOut } = useSignOut();
  const [open, setOpen] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [selectedRole, setSelectedRole] = useState(identity.role);
  const destination = useRef<StaffRole | null>(null);
  const roles = identity.roles ?? [identity.role];
  const switching = selectedRole !== identity.role;

  function selectRole(role: StaffRole) {
    if (role === identity.role || switching) return;
    destination.current = role;
    setSelectedRole(role);
    setOpen(false);
  }

  function finishClose(isOpen: boolean) {
    if (!isOpen && destination.current) {
      const role = destination.current;
      destination.current = null;
      activateExperience(role, experienceHome(role));
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen, details) => {
        if (switching) return;
        if (details.reason === "escape-key") setKeyboard(true);
        setOpen(nextOpen);
      }}
      onOpenChangeComplete={finishClose}
    >
      <PopoverTrigger
        aria-label={`Conta de ${identity.name} · ${identity.role === "TEACHER" ? "Professor" : "Administração"}`}
        title="Conta e perfis"
        data-keyboard={keyboard}
        className={styles.trigger}
        onPointerDown={() => setKeyboard(false)}
        onKeyDown={() => setKeyboard(true)}
        render={<Button variant="ghost" size="icon-compact-responsive" />}
      >
        <span className={styles.avatar}>
          <Avatar colorKey={identity.id} name={identity.name} />
          <span className={styles.chevron} aria-hidden="true">
            <ChevronDown className="size-3" />
          </span>
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        positionMethod="fixed"
        size="menu"
        motion={keyboard ? "instant" : "unfold"}
        className={styles.menu}
        data-keyboard={keyboard}
        aria-label="Conta e perfis"
        onKeyDown={() => setKeyboard(true)}
      >
        <div className={styles.identity} data-menu-item>
          <PopoverTitle>{identity.name}</PopoverTitle>
          <p className={styles.email}>{identity.email}</p>
        </div>
        <div className={styles.roles} aria-label="Escolher perfil" aria-busy={switching}>
          <span
            className={styles.selection}
            data-two={roles.length > 1}
            data-second={roles.indexOf(selectedRole) === 1}
            aria-hidden="true"
          />
          {roles.map((role) => (
            <Button
              key={role}
              variant="ghost"
              size="md"
              className={styles.choice}
              data-menu-item
              aria-pressed={role === selectedRole}
              disabled={switching}
              onClick={() => selectRole(role)}
            >
              {role === "TEACHER" ? (
                <GraduationCap aria-hidden="true" />
              ) : (
                <Shield aria-hidden="true" />
              )}
              {role === "TEACHER" ? "Professor" : "Administração"}
              <Check className={styles.check} aria-hidden="true" />
            </Button>
          ))}
        </div>
        <div className={styles.footer} data-menu-item>
          <Button
            variant="ghost"
            className={styles.choice}
            loading={pending}
            disabled={switching}
            onClick={() => void signOut()}
          >
            <LogOut aria-hidden="true" />
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
