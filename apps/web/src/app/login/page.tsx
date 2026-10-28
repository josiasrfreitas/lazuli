import type { Metadata, Viewport } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { isStaffAccessDeniedCode } from "@lazuli/auth";
import { auth } from "@lazuli/auth/server";

import { LoginCard, type LoginInitialError } from "./login-card";
import { LoginEntrance } from "./login-entrance";
import styles from "./login-entrance.module.css";

export const metadata: Metadata = {
  title: "Entrar",
};

export const viewport: Viewport = {
  interactiveWidget: "resizes-content",
};

/** Redirect signed-in staff and translate verification errors without exposing account status. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mode?: string; token?: string }>;
}): Promise<ReactNode> {
  const [session, params] = await Promise.all([
    auth.getSession({ headers: await headers() }),
    searchParams,
  ]);

  const registering = params.mode === "set-password";
  const resetting = params.mode === "reset" || registering;

  if (session !== null && !resetting && params.mode !== "register") {
    redirect("/");
  }

  return (
    <LoginEntrance skip={params.error !== undefined || resetting || params.mode === "register"}>
      <div className={styles.photograph} aria-hidden="true">
        <Image
          alt=""
          data-login-photo
          className={styles.photo}
          fill
          priority
          quality={90}
          sizes="100vw"
          src="/brand/login-students.jpg"
        />
        <div className={styles.scrim} />
      </div>
      <LoginHero />
      <section className={styles.access} aria-labelledby="login-title" data-login-reveal="panel">
        <LoginCard
          initialError={resetting ? null : resolveInitialError(params.error)}
          initialMode={registering ? "set-password" : resetting ? "reset" : params.mode === "register" ? "register" : "password"}
          token={params.error ? null : (params.token ?? null)}
        />
      </section>
    </LoginEntrance>
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
    <section data-login-hero className={styles.hero}>
      <h1 className={styles.headline} data-login-caption>
        <span className={styles.line}>
          <span data-login-reveal="line-one">Mais tempo para</span>
        </span>
        <span className={styles.line}>
          <span data-login-reveal="line-two">o que transforma.</span>
        </span>
      </h1>
      <p data-login-reveal="description" className={styles.description}>
        Uma gestão mais clara para quem faz a aprendizagem acontecer todos os dias.
      </p>
    </section>
  );
}
