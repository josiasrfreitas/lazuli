import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { STAFF_ACCESS_DENIED_CODE } from "@lazuli/auth";
import { auth } from "@lazuli/auth/server";

import { MarqueeCard } from "~/components/marquee/marquee-card";
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
 * back here: a staff-access denial carries our own code, and everything else
 * is some flavour of failed link. The card only ever distinguishes those two —
 * telling someone without access to "request a new link" would be a lie, and
 * naming the denial reason would leak whether an email exists.
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
        <MarqueeBody>
          Você atende o telefone e responde na hora, sem abrir três planilhas.
        </MarqueeBody>
        <MarqueeNote>Uso restrito à equipe da escola</MarqueeNote>
      </MarqueeEditorial>

      <MarqueeCard title="Acesso">
        <LoginCard initialError={resolveInitialError(params.error)} />
      </MarqueeCard>
    </MarqueePage>
  );
}

function resolveInitialError(error: string | undefined): LoginInitialError | null {
  if (error === undefined) {
    return null;
  }

  return error === STAFF_ACCESS_DENIED_CODE ? "denied" : "verification";
}
