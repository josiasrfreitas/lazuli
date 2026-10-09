import type { ReactNode } from "react";

import type { StaffIdentity, StaffRole } from "@lazuli/auth/server";
import { Avatar } from "@lazuli/ui";

import { SidebarNav } from "./sidebar-nav";
import { BrandSignature } from "./brand-signature";

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
    <aside className="group/sidebar hidden w-11.75 shrink-0 flex-col overflow-hidden border-r border-navigation-border bg-navigation text-navigation-foreground transition-[width] duration-300 ease-standard hover:w-43.75 has-[:focus-visible]:w-43.75 motion-reduce:transition-none sm:flex">
      <div className="flex h-14 w-43.75 shrink-0 items-center border-b border-navigation-border px-1.75">
        <BrandSignature />
      </div>
      <div className="scrollbar-subtle min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-4 pt-2">
        <SidebarNav role={identity.role} />
      </div>
      <footer className="flex w-43.75 items-center gap-3 border-t border-navigation-border px-1.75 py-4">
        <Avatar colorKey={identity.id} name={identity.name} />
        <div className="min-w-0 opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100 group-has-[:focus-visible]/sidebar:opacity-100 motion-reduce:transition-none">
          <p className="truncate text-caption font-semibold text-navigation-foreground">
            {identity.name}
          </p>
          <p className="truncate text-micro text-navigation-muted">{ROLE_LABELS[identity.role]}</p>
        </div>
      </footer>
    </aside>
  );
}
