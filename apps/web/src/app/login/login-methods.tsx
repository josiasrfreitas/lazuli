import { type FormEvent, type ReactNode } from "react";

import { Alert, AlertDescription, AlertIcon, Button } from "@lazuli/ui";

import { LoginForm, type LoginPending } from "./login-form";

/** Google's mark accompanies the sign-in button as required by their brand rules. */
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
