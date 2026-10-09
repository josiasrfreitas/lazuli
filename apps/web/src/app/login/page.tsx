import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getAuthEnvironment, isStaffAccessDeniedCode } from "@lazuli/auth";
import { auth } from "@lazuli/auth/server";

import { BrandSignature } from "~/components/app-shell/brand-signature";

import { LoginCard, type LoginInitialError } from "./login-card";

export const metadata: Metadata = {
  title: "Entrar",
};

/** Redirect signed-in staff and translate verification errors without exposing account status. */
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
    <main className="dark grid min-h-svh bg-marquee font-body text-marquee-foreground lg:grid-cols-[minmax(0,1.1fr)_minmax(440px,0.9fr)]">
      <LoginHero />

      <section
        className="flex min-h-[520px] items-center justify-center bg-gradient-to-br from-marquee via-navigation-active to-marquee px-7 py-16 sm:px-12 lg:px-16"
        aria-labelledby="login-title"
      >
        <div className="w-full max-w-md">
          <h2 className="text-4xl font-semibold tracking-tight" id="login-title">
            Boas-vindas de volta.
          </h2>
          <p className="mt-3 text-body leading-relaxed text-marquee-muted">
            Entre com o email da escola para continuar.
          </p>
          <div className="mt-10">
            <LoginCard
              googleOAuthEnabled={getAuthEnvironment().googleOAuth !== undefined}
              initialError={resolveInitialError(params.error)}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function resolveInitialError(error: string | undefined): LoginInitialError | null {
  if (error === undefined) {
    return null;
  }

  return isStaffAccessDeniedCode(error) ? "denied" : "verification";
}

function LoginHero(): ReactNode {
  return (
    <section className="relative isolate flex min-h-[320px] flex-col justify-between overflow-hidden px-7 py-8 sm:min-h-[420px] sm:px-12 sm:py-11 lg:min-h-svh lg:px-16 lg:py-14">
      <Image
        alt="Estudantes conversam e estudam juntos em uma biblioteca"
        className="-z-20 object-cover object-center"
        fill
        priority
        quality={90}
        sizes="(min-width: 1024px) max(55vw, 163vh), max(100vw, 685px)"
        src="/brand/login-students.jpg"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-b from-marquee/75 via-marquee/45 to-marquee/95"
      />
      <BrandSignature entry />
      <div className="max-w-xl">
        <p className="mb-5 text-caption font-semibold text-marquee-accent">Educação em movimento</p>
        <h1 className="text-hero font-bold leading-tight">
          <span className="block">Mais tempo para</span>
          <span className="block whitespace-nowrap">o que transforma.</span>
        </h1>
        <p className="mt-5 max-w-[37ch] text-body leading-relaxed text-marquee-foreground/85">
          Uma gestão mais clara para quem faz a aprendizagem acontecer todos os dias.
        </p>
      </div>
    </section>
  );
}
