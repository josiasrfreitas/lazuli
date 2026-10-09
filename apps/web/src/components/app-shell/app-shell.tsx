import type { ReactNode } from "react";

import type { StaffIdentity } from "@lazuli/auth/server";

import { formatLongDateSaoPaulo } from "~/lib/format";

import { AppBreadcrumb } from "./app-breadcrumb";
import { MobileNavigation } from "./mobile-navigation";
import { Sidebar } from "./sidebar";
import { SessionSync } from "./session-sync";
import { ThemeToggle } from "./theme-toggle";

/**
 * Frame of the authenticated product: fixed sidebar, a quiet topbar carrying
 * page context and the working date, and a scrollable content region. Rendered
 * by the `(app)` layout, so every vertical inherits it.
 */
export function AppShell({
  children,
  identity,
}: {
  children: ReactNode;
  identity: StaffIdentity;
}): ReactNode {
  return (
    <div className="flex h-svh bg-background text-foreground dark:bg-gradient-to-br dark:from-marquee dark:via-navigation-active dark:to-marquee">
      <SessionSync renderedEmail={identity.email} />
      <Sidebar identity={identity} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar identity={identity} />
        <main className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

/* The `(app)` layout reads request headers, so this renders per request and
 * the date is the secretary's current working day, not a build-time value. */
function TopBar({ identity }: { identity: StaffIdentity }): ReactNode {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-3 dark:bg-transparent sm:gap-4 sm:px-6">
      <MobileNavigation identity={identity} />
      <AppBreadcrumb role={identity.role} />
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <p className="hidden text-sm text-muted-foreground sm:block">
          {formatLongDateSaoPaulo(new Date())}
        </p>
        <ThemeToggle />
      </div>
    </header>
  );
}
