"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { Alert, AlertDescription, AlertIcon, Button, Field, Input, Label } from "@lazuli/ui";

import { authClient } from "~/lib/auth-client";

type LoginPending = "none" | "magic-link" | "google";

/** Replaces the form after sending, so another send cannot invalidate the first link. */
function MagicLinkSent({
  email,
  onUseAnotherEmail,
}: {
  email: string;
  onUseAnotherEmail: () => void;
}): ReactNode {
  return (
    <div className="flex flex-col" role="status">
      <p className="text-caption font-semibold text-marquee-accent">Link enviado</p>
      <p className="mt-3 text-body leading-relaxed">
        Enviamos um link de acesso para <span className="font-semibold">{email}</span>.
      </p>
      <p className="mt-5 text-caption leading-relaxed text-marquee-muted">
        Abra o email e clique no link para entrar. Se ele não chegar em alguns minutos, confira a
        caixa de spam.
      </p>
      <Button className="mt-8 self-start" onClick={onUseAnotherEmail} size="lg" variant="secondary">
        Usar outro email
      </Button>
    </div>
  );
}

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
export function LoginCard({
  googleOAuthEnabled,
  initialError,
}: {
  googleOAuthEnabled: boolean;
  initialError: LoginInitialError | null;
}): ReactNode {
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
    <LoginMethods
      {...{ email, error, googleOAuthEnabled, handleGoogle, handleMagicLink, pending, setEmail }}
    />
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

function LoginMethods({
  email,
  error,
  googleOAuthEnabled,
  handleGoogle,
  handleMagicLink,
  pending,
  setEmail,
}: {
  email: string;
  error: string | null;
  googleOAuthEnabled: boolean;
  handleGoogle: () => Promise<void>;
  handleMagicLink: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  pending: LoginPending;
  setEmail: (email: string) => void;
}): ReactNode {
  return (
    <div className="flex flex-col gap-6">
      <LoginAlert message={error} />
      {googleOAuthEnabled && (
        <OAuthSection onGoogle={() => void handleGoogle()} pending={pending === "google"} />
      )}
      <form className="flex flex-col gap-5" onSubmit={(event) => void handleMagicLink(event)}>
        <Field>
          <Label className="text-caption text-marquee-muted">Email institucional</Label>
          <Input
            autoComplete="email"
            /* text-body (16px): anything smaller makes iOS Safari zoom into the
               field on focus, and this is the product's front door. */
            className="h-control-lg rounded-none border-marquee-border bg-marquee-foreground/[0.03] text-body text-marquee-foreground placeholder:text-marquee-muted focus-visible:border-marquee-accent"
            disabled={pending !== "none"}
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@escola.com.br"
            required
            type="email"
            value={email}
          />
        </Field>

        <Button loading={pending === "magic-link"} size="lg" type="submit">
          Receber link de acesso
        </Button>
      </form>
    </div>
  );
}

function OAuthSection({
  onGoogle,
  pending,
}: {
  onGoogle: () => void;
  pending: boolean;
}): ReactNode {
  return (
    <>
      <Button loading={pending} onClick={onGoogle} size="lg" variant="secondary">
        <GoogleMark />
        Entrar com Google
      </Button>
      <p className="flex items-center gap-4 text-caption text-marquee-muted">
        <span aria-hidden="true" className="h-px flex-1 bg-marquee-border" />
        ou
        <span aria-hidden="true" className="h-px flex-1 bg-marquee-border" />
      </p>
    </>
  );
}

function GoogleMark(): ReactNode {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
        fill="#4285f4"
      />
      <path
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
        fill="#34a853"
      />
      <path
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
        fill="#fbbc05"
      />
      <path
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
        fill="#ea4335"
      />
    </svg>
  );
}

function LoginAlert({ message }: { message: string | null }): ReactNode {
  if (message === null) return null;
  return (
    <Alert
      className="flex items-center gap-3 rounded-none border-destructive/40"
      variant="destructive"
    >
      <AlertIcon className="translate-y-0">
        <img alt="" className="-my-2 size-8" src="/icons/login-error-mark.svg" />
      </AlertIcon>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
