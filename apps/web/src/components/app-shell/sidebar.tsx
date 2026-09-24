import type { ReactNode } from "react";

import type { StaffIdentity, StaffRole } from "@lazuli/auth/server";
import { Avatar } from "@lazuli/ui";

import { SidebarNav } from "./sidebar-nav";

/* How each role reads under the person's name — areas, not titles. */
const ROLE_LABELS: Record<StaffRole, string> = {
  SYSTEM_ADMIN: "Administração do sistema",
  ADMIN: "Administração",
  SECRETARY: "Secretaria",
  TEACHER: "Professor",
  FINANCE: "Financeiro",
};

export function Sidebar({ identity }: { identity: StaffIdentity }): ReactNode {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card sm:flex">
      <div className="px-6 pb-5 pt-6">
        <p className="font-display text-h3 font-semibold tracking-tight text-foreground">
          Lazuli
          <span aria-hidden="true" className="text-brand">
            .
          </span>
        </p>
      </div>
      <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto pb-4">
        <SidebarNav role={identity.role} />
      </div>
      <footer className="flex items-center gap-3 border-t border-border px-4 py-4">
        <Avatar colorKey={identity.id} name={identity.name} />
        <div className="min-w-0">
          <p className="truncate text-caption font-semibold text-foreground">{identity.name}</p>
          <p className="truncate text-micro text-muted-foreground">{ROLE_LABELS[identity.role]}</p>
        </div>
      </footer>
    </aside>
  );
}
