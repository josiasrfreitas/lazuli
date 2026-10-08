import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getAuthEnvironment, isStaffAccessDeniedCode } from "@lazuli/auth";
import { auth } from "@lazuli/auth/server";
import { cn } from "@lazuli/ui";

import {
  MarqueeBody,
  MarqueeEditorial,
  MarqueeEyebrow,
  MarqueeNote,
  MarqueePage,
  MarqueeTitle,
} from "~/components/marquee/marquee-layout";

import { LoginCard, type LoginInitialError } from "./login-card";

export const metadata: Metadata = {
  title: "Entrar — Lazuli",
};

/**
 * The door. Anyone who already has a session is sent straight through it —
 * there is no "you are already signed in" screen to read.
 *
 * The `error` query parameter is set by Better Auth when a verification comes
 * back here: a staff-access denial arrives under one of the codes
 * `isStaffAccessDeniedCode` knows, and everything else is some flavour of
 * failed link. The card only ever distinguishes those two — telling someone
 * without access to "request a new link" would be a lie, and naming the
 * denial reason would leak whether an email exists.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}): Promise<ReactNode> {
  const [session, params] = await Promise.all([
    auth.getSession({ headers: await headers() }),
    searchParams,
  ]);

  if (session !== null) {
    redirect("/");
  }

  return (
    <MarqueePage>
      <MarqueeEditorial>
        <MarqueeEyebrow detail="Entrar" label="Lazuli" />
        <MarqueeTitle accent="simplificada." lead="Sua gestão escolar," />
        <MarqueeBody>Matrículas, presença e pagamentos num lugar só.</MarqueeBody>
        <MarqueeNote>Uso restrito à equipe da escola</MarqueeNote>
      </MarqueeEditorial>

      <LoginCardFrame>
        <LoginCard
          googleOAuthEnabled={getAuthEnvironment().googleOAuth !== undefined}
          initialError={resolveInitialError(params.error)}
        />
      </LoginCardFrame>
    </MarqueePage>
  );
}

function resolveInitialError(error: string | undefined): LoginInitialError | null {
  if (error === undefined) {
    return null;
  }

  return isStaffAccessDeniedCode(error) ? "denied" : "verification";
}

function LoginCardFrame({ children }: { children: ReactNode }): ReactNode {
  return (
    <section className="relative border border-marquee-border bg-marquee-foreground/[0.015]">
      <header
        className={cn([
          "flex items-center justify-between gap-6 border-b border-marquee-border px-6 py-4 sm:px-10",
          "font-mono text-micro font-semibold uppercase tracking-eyebrow",
        ])}
      >
        <span className="text-marquee-muted">Acesso</span>
      </header>
      <div className="flex flex-col justify-center px-6 py-10 sm:px-10">{children}</div>
      <span aria-hidden="true">
        {[
          "-top-px -left-px border-t border-l",
          "-top-px -right-px border-t border-r",
          "-bottom-px -left-px border-b border-l",
          "-bottom-px -right-px border-b border-r",
        ].map((corner) => (
          <span className={cn("absolute size-4 border-marquee-accent/60", corner)} key={corner} />
        ))}
      </span>
    </section>
  );
}
