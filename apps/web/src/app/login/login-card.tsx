"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { Alert, AlertDescription, Button } from "@lazuli/ui";

import { marqueeQuietActionClass } from "~/components/marquee/marquee-layout";
import { authClient } from "~/lib/auth-client";

import { GoogleMark } from "./google-mark";
import { LoginForm, type LoginPending } from "./login-form";
import { MagicLinkSent } from "./magic-link-sent";

/**
 * Every rejection is reported with the same sentence, whatever the cause, so the
 * screen never confirms whether an address belongs to the school. A send that
 * fails for another reason says so plainly instead — telling someone their
 * access was denied when the mail server was down would simply be untrue.
 */
const DENIED_MESSAGE = "Acesso não autorizado. Fale com a secretaria.";
const SEND_FAILURE_MESSAGE = "Não foi possível enviar o link. Tente novamente em alguns instantes.";
const VERIFICATION_FAILURE_MESSAGE = "Link inválido ou expirado. Peça um novo abaixo.";
const UNAUTHORIZED_STATUS = 401;

/**
 * How a verification redirect landed back here: access denied (no new link
 * will ever help) or a failed link (a new one will). The page derives this
 * from the `error` query parameter; the card never sees the raw code.
 */
export type LoginInitialError = "denied" | "verification";

/**
 * The two ways in. Neither creates an account — sign-up is disabled on both
 * providers — so the card only ever recognises someone the school already knows.
 */
export function LoginCard({ initialError }: { initialError: LoginInitialError | null }): ReactNode {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState<LoginPending>("none");
  const [error, setError] = useState<string | null>(initialErrorMessage(initialError));

  async function handleMagicLink(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setPending("magic-link");

    const failure = await sendMagicLink(email);

    setPending("none");
    setError(failure);

    if (failure === null) {
      setSentTo(email);
    }
  }

  async function handleGoogle(): Promise<void> {
    setError(null);
    setPending("google");

    const failure = await startGoogleSignIn();

    if (failure !== null) {
      setPending("none");
      setError(failure);
    }
  }

  if (sentTo !== null) {
    return <MagicLinkSent email={sentTo} onUseAnotherEmail={() => setSentTo(null)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <LoginAlert message={error} />
      <GoogleButton onClick={() => void handleGoogle()} pending={pending === "google"} />
      <Divider />
      <LoginForm
        email={email}
        onEmailChange={setEmail}
        onSubmit={(event) => void handleMagicLink(event)}
        pending={pending}
      />
    </div>
  );
}

function initialErrorMessage(initialError: LoginInitialError | null): string | null {
  if (initialError === null) {
    return null;
  }

  return initialError === "denied" ? DENIED_MESSAGE : VERIFICATION_FAILURE_MESSAGE;
}

/** Returns the message to show, or `null` when the link is on its way. */
async function sendMagicLink(email: string): Promise<string | null> {
  const result = await authClient.signIn.magicLink({
    callbackURL: "/",
    email,
    errorCallbackURL: "/login",
  });

  if (result.error === null) {
    return null;
  }

  return result.error.status === UNAUTHORIZED_STATUS ? DENIED_MESSAGE : SEND_FAILURE_MESSAGE;
}

/**
 * Returns the message to show, or `null` when the browser is already on its way
 * to Google — in which case nothing here gets to render again.
 */
async function startGoogleSignIn(): Promise<string | null> {
  const result = await authClient.signIn.social({
    callbackURL: "/",
    errorCallbackURL: "/login",
    provider: "google",
  });

  return result.error === null ? null : DENIED_MESSAGE;
}

function LoginAlert({ message }: { message: string | null }): ReactNode {
  if (message === null) {
    return null;
  }

  return (
    /* border-destructive/40: the primitive's 20% border melts into the navy
       surface, and everything else on this frame is ruled by a crisp hairline. */
    <Alert className="rounded-none border-destructive/40" variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function GoogleButton({ onClick, pending }: { onClick: () => void; pending: boolean }): ReactNode {
  return (
    <Button
      className={marqueeQuietActionClass}
      loading={pending}
      onClick={onClick}
      variant="secondary"
    >
      <GoogleMark />
      Entrar com Google
    </Button>
  );
}

function Divider(): ReactNode {
  return (
    <p className="flex items-center gap-4 font-mono text-micro uppercase tracking-eyebrow text-marquee-muted">
      <span aria-hidden="true" className="h-px flex-1 bg-marquee-border" />
      ou
      <span aria-hidden="true" className="h-px flex-1 bg-marquee-border" />
    </p>
  );
}
