"use client";

import { MailCheck, Check } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { Alert, AlertDescription, Button } from "@lazuli/ui";

import { submitLogin } from "./login-actions";
import { LoginForm, type LoginMode } from "./login-form";
import styles from "./login-entrance.module.css";

export type LoginInitialError = "denied" | "verification";
const DESCRIPTION: Record<LoginMode, string> = {
  password: "Entre com seu email e sua senha.",
  "magic-link": "Receba um link no email para entrar sem senha.",
  register:
    "Receba um link no email cadastrado na escola. Ao abrir, você volta aqui para escolher sua senha.",
  recover: "Enviaremos um link no seu email para você escolher uma nova senha.",
  reset: "Escolha sua senha para entrar na Lazuli.",
  "set-password": "Escolha uma senha para os próximos acessos à Lazuli.",
};

export function LoginCard({
  initialError,
  initialMode = "password",
  token = null,
}: {
  initialError: LoginInitialError | null;
  initialMode?: LoginMode;
  token?: string | null;
}): ReactNode {
  const [mode, setMode] = useState<LoginMode>(
    initialError === "verification" ? "magic-link" : initialMode,
  );
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [modeDirection, setModeDirection] = useState<"forward" | "back" | null>(null);
  const [error, setError] = useState(
    initialError === "denied"
      ? "Acesso não autorizado. Fale com a secretaria."
      : initialError === "verification"
        ? "Link inválido ou expirado. Peça um novo abaixo."
        : null,
  );
  const container = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  const [expired, setExpired] = useState(false);
  const [linkToken, setLinkToken] = useState(token);
  const [linkReady, setLinkReady] = useState(false);
  const definingPassword = mode === "reset" || mode === "set-password";
  const invalidReset = definingPassword && linkReady && (!linkToken || expired);
  const requestMode = mode === "set-password" ? "register" : "recover";
  const lastFocusState = useRef({ mode, complete, invalidReset });

  useEffect(() => {
    const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get("token");
    setLinkToken(fragmentToken || token);
    setLinkReady(true);
    if (fragmentToken || (token && window.location.search.includes("token="))) {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
  }, [token]);

  useEffect(() => {
    if (
      lastFocusState.current.mode === mode &&
      lastFocusState.current.complete === complete &&
      lastFocusState.current.invalidReset === invalidReset
    )
      return;
    lastFocusState.current = { mode, complete, invalidReset };
    container.current
      ?.querySelector<HTMLElement>(complete ? '[role="status"]' : "input, button")
      ?.focus({ preventScroll: true });
  }, [mode, complete, invalidReset]);

  function changeMode(next: LoginMode): void {
    setModeDirection(next === "password" ? "back" : "forward");
    setMode(next);
    setComplete(false);
    setError(null);
    setExpired(false);
    setLinkToken(null);
    if (linkToken || window.location.pathname !== "/login")
      window.history.replaceState(window.history.state, "", "/login");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting.current || !event.currentTarget.reportValidity()) return;
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    submitting.current = true;
    setPending(true);
    setError(null);
    const failure = await submitLogin(mode, email.trim(), password, linkToken);
    setError(failure?.message ?? null);
    if (failure?.expired) {
      setExpired(true);
      setError(null);
    }
    if (failure === null && mode !== "password") setComplete(true);
    if (failure !== null || mode !== "password") {
      setPending(false);
      submitting.current = false;
    }
  }

  return (
    <div
      ref={container}
      className={styles.accessContent}
      data-login-reveal="form"
      data-error={error !== null || undefined}
      data-mode-change={modeDirection ?? undefined}
    >
      <h2
        key={`title-${complete ? "complete" : mode}`}
        className={styles.accessTitle}
        id="login-title"
      >
        {complete ? (definingPassword ? "Senha salva." : "Confira seu email.") : title(mode)}
      </h2>
      {complete ? (
        <LoginComplete mode={mode} email={email} onBack={() => changeMode("password")} />
      ) : (
        <>
          <p key={`description-${mode}`} className={styles.accessDescription}>
            {DESCRIPTION[mode]}
          </p>
          <div key={`methods-${mode}`} className={styles.methods}>
            <div className={styles.controlStack}>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {invalidReset ? (
                <>
                  <Alert variant="destructive">
                    <AlertDescription>
                      Link inválido ou expirado. Solicite um novo para definir sua senha.
                    </AlertDescription>
                  </Alert>
                  <Button onClick={() => changeMode(requestMode)}>Solicitar novo link</Button>
                </>
              ) : (
                <LoginForm
                  key={mode}
                  mode={mode}
                  pending={pending}
                  email={email}
                  setEmail={setEmail}
                  onSubmit={(event) => void handleSubmit(event)}
                  onModeChange={changeMode}
                  className={styles.emailForm}
                />
              )}
              {definingPassword && error && (
                <Button variant="secondary" onClick={() => changeMode(requestMode)}>
                  Solicitar novo link
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function title(mode: LoginMode): ReactNode {
  if (mode === "register" || mode === "set-password") return "Cadastre sua senha.";
  if (mode === "recover") return "Recupere seu acesso.";
  if (mode === "reset") return "Sua nova senha.";
  if (mode === "magic-link") return "Entre pelo email.";
  return (
    <>
      Boas-vindas <span>de volta.</span>
    </>
  );
}

function LoginComplete({
  mode,
  email,
  onBack,
}: {
  mode: LoginMode;
  email: string;
  onBack: () => void;
}): ReactNode {
  const saved = mode === "reset" || mode === "set-password";
  const passwordEmail = mode === "recover" || mode === "register";
  return (
    <div className={styles.sent} role="status" tabIndex={-1}>
      <div className={styles.sentMark} aria-hidden="true">
        {saved ? <Check /> : <MailCheck />}
      </div>
      <p className="text-body leading-relaxed">
        {saved ? (
          "Tudo pronto. Entre com seu email e sua nova senha."
        ) : passwordEmail ? (
          <>
            Se <strong>{email}</strong> tiver acesso à Lazuli, você receberá um link para{" "}
            {mode === "register" ? "cadastrar" : "recuperar"} sua senha.
          </>
        ) : (
          <>
            Se <strong>{email}</strong> tiver acesso à Lazuli, você receberá um link para entrar.
          </>
        )}
      </p>
      {!saved && (
        <p className="mt-4 text-body leading-relaxed text-marquee-muted">
          Se não encontrar o email, confira a caixa de spam.
          {passwordEmail &&
            " Abra o link para escolher sua senha no site. Ele vale por 15 minutos."}
        </p>
      )}
      <Button className="mt-5" size="lg" variant={saved ? "primary" : "secondary"} onClick={onBack}>
        {saved ? "Entrar com minha senha" : "Voltar para o login"}
      </Button>
    </div>
  );
}
