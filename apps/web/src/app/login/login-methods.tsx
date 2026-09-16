import { type FormEvent, type ReactNode } from "react";

import { Alert, AlertDescription, AlertIcon, Button } from "@lazuli/ui";

import { GoogleMark } from "./google-mark";
import { LoginForm, type LoginPending } from "./login-form";

export function LoginMethods({
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
      <LoginForm
        email={email}
        onEmailChange={setEmail}
        onSubmit={(event) => void handleMagicLink(event)}
        pending={pending}
      />
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
      <p className="flex items-center gap-4 font-mono text-micro uppercase tracking-eyebrow text-marquee-muted">
        <span aria-hidden="true" className="h-px flex-1 bg-marquee-border" />
        ou
        <span aria-hidden="true" className="h-px flex-1 bg-marquee-border" />
      </p>
    </>
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
