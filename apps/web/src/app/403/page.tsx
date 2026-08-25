import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { auth } from "@lazuli/auth/server";
import { Button } from "@lazuli/ui";

import {
  MarqueeActions,
  MarqueeBody,
  MarqueeEditorial,
  MarqueePage,
  MarqueeTitle,
} from "~/components/marquee/marquee-layout";

import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = {
  title: "Acesso restrito — Lazuli",
};

/**
 * Where a signed-in person lands when their role does not reach a page. It sits
 * outside the `(app)` route group on purpose: guarding the page that explains a
 * failed guard would send people round in a circle.
 */
export default async function ForbiddenPage(): Promise<ReactNode> {
  const session = await auth.getSession({ headers: await headers() });

  return (
    <MarqueePage contentClassName="gap-2 py-5 lg:max-w-[1680px] lg:grid-cols-[minmax(25rem,0.72fr)_minmax(0,1.28fr)] lg:gap-6 lg:px-10 lg:py-8">
      <MarqueeEditorial>
        <MarqueeTitle
          accent="é restrita."
          className="mt-0 text-[clamp(3rem,6vw,6rem)]"
          lead="Esta área"
        />
        <MarqueeBody className="max-w-[43ch] text-balance">
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
      </MarqueeEditorial>

      <section
        aria-label="Acesso bloqueado"
        className="relative hidden min-h-0 items-center justify-center lg:flex"
      >
        <div className="relative aspect-square w-full max-w-[min(31svh,18rem)] lg:max-w-[min(78svh,52rem)]">
          <Image
            alt=""
            className="h-auto w-full select-none mix-blend-lighten"
            height={1254}
            priority
            sizes="(min-width: 1024px) 58vw, (min-width: 640px) 78vw, calc(100vw - 3rem)"
            src="/images/forbidden-mine.png"
            width={1254}
          />
          <MineRegistrationFrame />
        </div>
      </section>
    </MarqueePage>
  );
}

function MineRegistrationFrame(): ReactNode {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-y-[3%] -inset-x-[7%]">
      <span className="absolute left-0 top-0 size-10 border-l border-t border-marquee-accent/60" />
      <span className="absolute right-0 top-0 size-10 border-r border-t border-marquee-accent/60" />
      <span className="absolute bottom-0 left-0 size-10 border-b border-l border-marquee-accent/60" />
      <span className="absolute bottom-0 right-0 size-10 border-b border-r border-marquee-accent/60" />
    </div>
  );
}
