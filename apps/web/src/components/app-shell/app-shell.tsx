import type { ReactNode } from "react";

import type { StaffIdentity } from "@lazuli/auth/server";

import { formatLongDateSaoPaulo } from "~/lib/format";

import { Sidebar } from "./sidebar";

/**
 * Frame of the authenticated product: fixed sidebar, a quiet topbar carrying
 * the working date, and a scrollable content region. Rendered by the `(app)`
 * layout, so every vertical inherits it.
 */
export function AppShell({
  children,
  identity,
}: {
  children: ReactNode;
  identity: StaffIdentity;
}): ReactNode {
  return (
    <div className="flex h-svh bg-background text-foreground">
      <Sidebar identity={identity} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

/* The `(app)` layout reads request headers, so this renders per request and
 * the date is the secretary's current working day, not a build-time value. */
function TopBar(): ReactNode {
  return (
    <header className="flex h-14 shrink-0 items-center justify-end border-b border-border px-6">
      <p className="text-caption text-muted-foreground">{formatLongDateSaoPaulo(new Date())}</p>
    </header>
  );
}
