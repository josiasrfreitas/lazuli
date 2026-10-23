"use client";

import { ArrowUpRight, MailCheck } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { Alert, AlertDescription, AlertIcon, Button, Field, Input, Label } from "@lazuli/ui";

import { authClient } from "~/lib/auth-client";

import styles from "./login-entrance.module.css";

type LoginPending = "none" | "magic-link";

/** Replaces the form after sending, so another send cannot invalidate the first link. */
function MagicLinkSent({
  email,
  onUseAnotherEmail,
}: {
  email: string;
  onUseAnotherEmail: () => void;
}): ReactNode {
  return (
    <div className={styles.accessContent}>
      <h2 className={styles.accessTitle} id="login-title">
        Confira seu email.
      </h2>
      <div className={styles.sent} role="status">
        <div className={styles.sentMark} aria-hidden="true">
          <MailCheck />
        </div>
        <p className="text-body leading-relaxed">
          Link de acesso enviado para <span className="font-semibold">{email}</span>.
        </p>
        <p className="mt-4 text-body leading-relaxed text-marquee-muted">
          Abra o link no email para entrar. Se não chegar em alguns minutos, confira a caixa de
          spam.
        </p>
        <Button className="mt-5" onClick={onUseAnotherEmail} size="lg" variant="secondary">
          Usar outro email
        </Button>
      </div>
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

/** Magic links only recognise staff members already registered by the school. */
export function LoginCard({ initialError }: { initialError: LoginInitialError | null }): ReactNode {
  const { email, error, pending, sentTo, setEmail, setSentTo, handleMagicLink } =
    useLoginCard(initialError);

  if (sentTo !== null) {
    return <MagicLinkSent email={sentTo} onUseAnotherEmail={() => setSentTo(null)} />;
  }

  return (
    <div
      className={styles.accessContent}
      data-login-reveal="form"
      data-error={error !== null || undefined}
    >
      <div>
        <h2 className={styles.accessTitle} id="login-title">
          Boas-vindas <span>de volta.</span>
        </h2>
        <p className={styles.accessDescription}>Entre com o email da escola.</p>
      </div>
      <div className={styles.methods}>
        <LoginMethods {...{ email, error, handleMagicLink, pending, setEmail }} />
      </div>
    </div>
  );
}

function useLoginCard(initialError: LoginInitialError | null): {
  email: string;
  error: string | null;
  pending: LoginPending;
  sentTo: string | null;
  setEmail: (email: string) => void;
  setSentTo: (email: string | null) => void;
  handleMagicLink: (event: FormEvent<HTMLFormElement>) => Promise<void>;
} {
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

  return { email, error, pending, sentTo, setEmail, setSentTo, handleMagicLink };
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

function LoginMethods({
  email,
  error,
  handleMagicLink,
  pending,
  setEmail,
}: {
  email: string;
  error: string | null;
  handleMagicLink: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  pending: LoginPending;
  setEmail: (email: string) => void;
}): ReactNode {
  return (
    <div className={styles.controlStack}>
      <LoginAlert message={error} />
      <EmailSignInForm {...{ email, handleMagicLink, pending, setEmail }} />
    </div>
  );
}

function EmailSignInForm({
  email,
  handleMagicLink,
  pending,
  setEmail,
}: {
  email: string;
  handleMagicLink: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  pending: LoginPending;
  setEmail: (email: string) => void;
}): ReactNode {
  return (
    <form className={styles.emailForm} onSubmit={(event) => void handleMagicLink(event)}>
      <Field>
        <Label className="text-body text-marquee-foreground">Email institucional</Label>
        <Input
          autoComplete="email"
          size="lg"
          className="text-body"
          disabled={pending !== "none"}
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@escola.com.br"
          required
          type="email"
          value={email}
        />
      </Field>
      <Button
        disabled={pending !== "none"}
        loading={pending === "magic-link"}
        size="lg"
        type="submit"
      >
        Receber link de acesso
        <ArrowUpRight aria-hidden="true" />
      </Button>
    </form>
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
