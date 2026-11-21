import { isAdministrativeRole } from "@lazuli/auth/roles";
import type { ReactNode } from "react";

import type { StaffIdentity } from "@lazuli/auth/server";

import { CommandPalette } from "~/features/command-palette/command-palette";

import { formatLongDateSaoPaulo } from "~/lib/format";

import { AppBreadcrumb } from "./app-breadcrumb";
import { AdminMobileNotice } from "./admin-mobile-notice";
import { MobileNavigation } from "./mobile-navigation";
import { Sidebar } from "./sidebar";
import styles from "./app-shell.module.css";
import { ThemeToggle } from "./theme-toggle";
import { TeacherViewProvider } from "~/lib/teacher-view-navigation";
import { SessionSync } from "./session-sync";
import { AccountMenu } from "./account-menu";
import { TeacherNavigation } from "~/features/teacher-workspace/navigation";
import { AssessmentUploadProvider } from "~/features/assessment-files/queue-provider";

/**
 * Frame of the authenticated product: fixed sidebar, a quiet topbar carrying
 * page context and the working date, and a scrollable content region. Rendered
 * by the `(app)` layout, so every vertical inherits it.
 */
export function AppShell({
  children,
  identity,
  isMobileDevice,
}: {
  children: ReactNode;
  identity: StaffIdentity;
  isMobileDevice: boolean;
}): ReactNode {
  const surface = (
    <>
      <TopBar identity={identity} />
      {identity.viewer && (
        <aside className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted px-4 py-2 text-sm">
          <span>
            Visualizando como <strong>{identity.name}</strong> · Somente leitura
          </span>
          <a className="underline" href="/perfil?perfil=SUPER_ADMIN&retorno=/alunos">
            Voltar à administração
          </a>
        </aside>
      )}
      <main className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto">{children}</main>
      {identity.role === "TEACHER" && <TeacherNavigation />}
    </>
  );
  return (
    <TeacherViewProvider value={identity.viewer ? identity.id : null}>
      <div className={`${styles.shell} flex h-svh bg-background text-foreground`}>
        <SessionSync renderedEmail={identity.viewer?.email ?? identity.email} />
        {isAdministrativeRole(identity.role) && (
          <AdminMobileNotice
            key={identity.id}
            userId={identity.id}
            isMobileDevice={isMobileDevice}
          />
        )}
        <Sidebar identity={identity} />
        <div className="flex min-w-0 flex-1 flex-col">
          {identity.viewer ? (
            surface
          ) : (
            <AssessmentUploadProvider userId={identity.id} email={identity.email}>
              {surface}
            </AssessmentUploadProvider>
          )}
        </div>
      </div>
    </TeacherViewProvider>
  );
}

/* The `(app)` layout reads request headers, so this renders per request and
 * the date is the secretary's current working day, not a build-time value. */
function TopBar({ identity }: { identity: StaffIdentity }): ReactNode {
  return (
    <header
      data-top-bar=""
      className={
        identity.role === "TEACHER"
          ? "flex h-12 shrink-0 items-center gap-2 border-b border-border bg-navigation-bar text-foreground px-2 sm:px-4"
          : "flex h-14 shrink-0 items-center gap-3 border-b border-border bg-navigation-bar text-foreground px-3 sm:gap-4 sm:px-6"
      }
    >
      <MobileNavigation identity={identity} />
      <AppBreadcrumb role={identity.role} />
      <div
        className={
          identity.role === "TEACHER"
            ? "ml-auto flex min-w-0 items-center gap-1"
            : "ml-auto flex shrink-0 items-center gap-3"
        }
      >
        <CommandPalette role={identity.role} />
        {identity.role !== "TEACHER" && (
          <p className="hidden text-sm text-muted-foreground sm:block">
            {formatLongDateSaoPaulo(new Date())}
          </p>
        )}
        <ThemeToggle />
        <AccountMenu identity={identity} />
      </div>
    </header>
  );
}
