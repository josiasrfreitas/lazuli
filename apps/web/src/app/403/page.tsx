import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";

import { auth } from "@lazuli/auth/server";
import { Button } from "@lazuli/ui";

import { MarqueeCard } from "~/components/marquee/marquee-card";
import {
  MarqueeActions,
  MarqueeBody,
  MarqueeEditorial,
  MarqueeEyebrow,
  MarqueeNote,
  MarqueePage,
  MarqueeTitle,
} from "~/components/marquee/marquee-layout";
import { SpecimenCrystal } from "~/components/marquee/specimen-crystal";

import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = {
  title: "Acesso restrito — Lazuli",
};

const SPECIMEN_META = [
  { label: "Status", value: "Bloqueado" },
  { label: "Motivo", value: "Sem permissão" },
] as const;

/**
 * Where a signed-in person lands when their role does not reach a page. It sits
 * outside the `(app)` route group on purpose: guarding the page that explains a
 * failed guard would send people round in a circle.
 */
export default async function ForbiddenPage(): Promise<ReactNode> {
  const session = await auth.getSession({ headers: await headers() });

  return (
    <MarqueePage>
      <MarqueeEditorial>
        <MarqueeEyebrow detail="Sem permissão" label="Erro 403" />
        <MarqueeTitle accent="é restrita." lead="Esta área" />
        <MarqueeBody>
          Você não tem permissão para abrir esta página. Se isso parece um engano, fale com a
          secretaria.
        </MarqueeBody>
        <MarqueeActions>
          <Button nativeButton={false} render={<Link href="/" />} size="lg">
            Voltar ao início
            <ArrowUpRight aria-hidden="true" />
          </Button>
          {session === null ? null : <SignOutButton />}
        </MarqueeActions>
        <MarqueeNote>Código do erro: LAZ-403</MarqueeNote>
      </MarqueeEditorial>

      <MarqueeCard code="LAZ-403" meta={SPECIMEN_META} title="Amostra mineral">
        <div className="flex flex-col items-center gap-8">
          <div className="relative flex w-full justify-center">
            <SpecimenCrystal />
            <span className="absolute inset-0 flex items-center justify-center text-[clamp(3rem,7vw,4.25rem)] font-bold leading-none text-marquee-foreground/95">
              403
            </span>
          </div>
          <p className="font-mono text-micro uppercase tracking-eyebrow text-brand">Forbidden</p>
        </div>
      </MarqueeCard>
    </MarqueePage>
  );
}
