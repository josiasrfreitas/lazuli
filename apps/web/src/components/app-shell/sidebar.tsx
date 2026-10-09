import type { ReactNode } from "react";

import type { StaffIdentity } from "@lazuli/auth/server";

import { AccountFooter } from "./account-footer";
import { SidebarNav } from "./sidebar-nav";
import { BrandSignature } from "./brand-signature";

export function Sidebar({ identity }: { identity: StaffIdentity }): ReactNode {
  return (
    <aside className="group/sidebar hidden w-11.75 shrink-0 flex-col overflow-hidden border-r border-navigation-border bg-navigation text-navigation-foreground transition-[width] duration-300 ease-standard hover:w-43.75 has-[:focus-visible]:w-43.75 motion-reduce:transition-none sm:flex">
      <div className="flex h-14 w-43.75 shrink-0 items-center border-b border-navigation-border px-1.75">
        <BrandSignature />
      </div>
      <div className="scrollbar-subtle min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-4 pt-2">
        <SidebarNav role={identity.role} />
      </div>
      <div className="w-43.75">
        <AccountFooter identity={identity} />
      </div>
    </aside>
  );
}
