"use client";

import { MailCheck, Check } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";

import { Button, toastManager } from "@lazuli/ui";

import { submitLogin } from "./login-actions";
import { showLoginError } from "./login-error-toast";
import { LoginForm, type LoginMode } from "./login-form";
import styles from "./login-entrance.module.css";

export type LoginInitialError = "denied" | "verification";
const DENIED_MESSAGE = "Acesso não autorizado. Fale com a secretaria.";
const SET_PASSWORD_MODE = "set-password";
const DESCRIPTION: Record<LoginMode, string> = {
  password: "Entre com seu email e sua senha.",
  "magic-link": "Receba um link no email para entrar sem senha.",
  register:
    "Receba um link no email cadastrado na escola. Ao abrir, você volta aqui para escolher sua senha.",
  recover: "Enviaremos um link no seu email para você escolher uma nova senha.",
  reset: "Escolha sua senha para entrar na Lazuli.",
  "set-password": "Escolha uma senha para os próximos acessos à Lazuli.",
};

function initialLoginError(error: LoginInitialError | null): string | null {
  if (error === "denied") return DENIED_MESSAGE;
  if (error === "verification") return "Link inválido ou expirado. Peça um novo abaixo.";
  return null;
}

function useLoginToken(token: string | null): {
  linkToken: string | null;
  linkReady: boolean;
  setLinkToken: Dispatch<SetStateAction<string | null>>;
} {
  const [linkToken, setLinkToken] = useState(token);
  const [linkReady, setLinkReady] = useState(false);
  useEffect(() => {
    const fragmentToken = new URLSearchParams(globalThis.location.hash.slice(1)).get("token");
    setLinkToken(fragmentToken || token);
    setLinkReady(true);
    if (fragmentToken || (token && globalThis.location.search.includes("token="))) {
      globalThis.history.replaceState(globalThis.history.state, "", globalThis.location.pathname);
    }
  }, [token]);
  return { linkToken, linkReady, setLinkToken };
}

function useLoginFocus({
  container,
  mode,
  complete,
  invalidReset,
}: {
  container: RefObject<HTMLDivElement | null>;
  mode: LoginMode;
  complete: boolean;
  invalidReset: boolean;
}): void {
  const lastFocusState = useRef({ mode, complete, invalidReset });
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
  }, [container, mode, complete, invalidReset]);
}

type LoginCardInput = {
  initialError: LoginInitialError | null;
  initialMode?: LoginMode;
  token?: string | null;
};

type LoginSubmitContext = {
  mode: LoginMode;
  email: string;
  token: string | null;
  submitting: RefObject<boolean>;
  setPending: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setExpired: Dispatch<SetStateAction<boolean>>;
  setComplete: Dispatch<SetStateAction<boolean>>;
};

function finishLoginSubmit(
  context: LoginSubmitContext,
  failure: Awaited<ReturnType<typeof submitLogin>>,
): void {
  context.setError(failure?.expired ? null : (failure?.message ?? null));
  context.setExpired(Boolean(failure?.expired));
  if (failure === null && context.mode !== "password") context.setComplete(true);
  if (failure !== null || context.mode !== "password") {
    context.setPending(false);
    context.submitting.current = false;
  }
}

function createLoginSubmit(
  context: LoginSubmitContext,
): (event: FormEvent<HTMLFormElement>) => Promise<void> {
  return async (event) => {
    event.preventDefault();
    if (context.submitting.current || !event.currentTarget.reportValidity()) return;
    const passwordValue = new FormData(event.currentTarget).get("password");
    const password = typeof passwordValue === "string" ? passwordValue : "";
    context.submitting.current = true;
    context.setPending(true);
    context.setError(null);
    const failure = await submitLogin({
      mode: context.mode,
      email: context.email.trim(),
      password,
      token: context.token,
    });
    finishLoginSubmit(context, failure);
  };
}

function useLoginCard({
  initialError,
  initialMode = "password",
  token = null,
}: LoginCardInput): LoginCardViewProps {
  const [mode, setMode] = useState<LoginMode>(
    initialError === "verification" ? "magic-link" : initialMode,
  );
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [modeDirection, setModeDirection] = useState<"forward" | "back" | null>(null);
  const [error, setError] = useState(initialLoginError(initialError));
  const container = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  const [expired, setExpired] = useState(false);
  const { linkToken, linkReady, setLinkToken } = useLoginToken(token);
  const definingPassword = mode === "reset" || mode === SET_PASSWORD_MODE;
  const invalidReset = definingPassword && linkReady && (!linkToken || expired);
  const requestMode = mode === SET_PASSWORD_MODE ? "register" : "recover";
  useLoginFocus({ container, mode, complete, invalidReset });
  const changeMode = (next: LoginMode): void => {
    setModeDirection(next === "password" ? "back" : "forward");
    setMode(next);
    setComplete(false);
    setError(null);
    setExpired(false);
    setLinkToken(null);
    if (linkToken || globalThis.location.pathname !== "/login")
      globalThis.history.replaceState(globalThis.history.state, "", "/login");
  };
  const handleSubmit = createLoginSubmit({
    mode,
    email,
    token: linkToken,
    submitting,
    setPending,
    setError,
    setExpired,
    setComplete,
  });
  const status = { mode, email, pending, complete, modeDirection, error, container };
  const actions = { setEmail, changeMode, handleSubmit };
  return { ...status, invalidReset, definingPassword, requestMode, ...actions };
}

export function LoginCard(props: LoginCardInput): ReactNode {
  const view = useLoginCard(props);
  useEffect(() => {
    const message = view.invalidReset
      ? "Link inválido ou expirado. Solicite um novo para definir sua senha."
      : view.error;
    if (!message) return;
    const id = showLoginError(message);
    return () => toastManager.close(id);
  }, [view.error, view.invalidReset]);
  return <LoginCardView {...view} />;
}

type LoginCardViewProps = {
  mode: LoginMode;
  email: string;
  pending: boolean;
  complete: boolean;
  modeDirection: "forward" | "back" | null;
  error: string | null;
  container: RefObject<HTMLDivElement | null>;
  invalidReset: boolean;
  definingPassword: boolean;
  requestMode: LoginMode;
  setEmail: Dispatch<SetStateAction<string>>;
  changeMode: (next: LoginMode) => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

function LoginCardView({
  mode,
  email,
  pending,
  complete,
  modeDirection,
  error,
  container,
  invalidReset,
  definingPassword,
  requestMode,
  setEmail,
  changeMode,
  handleSubmit,
}: LoginCardViewProps): ReactNode {
  return (
    <div
      ref={container}
      className={styles.accessContent}
      data-login-reveal="form"
      data-mode-change={modeDirection ?? undefined}
    >
      <LoginCardHeading mode={mode} complete={complete} definingPassword={definingPassword} />
      {complete ? (
        <LoginComplete mode={mode} email={email} onBack={() => changeMode("password")} />
      ) : (
        <LoginCardMethods
          {...{
            mode,
            email,
            pending,
            error,
            invalidReset,
            definingPassword,
            requestMode,
            setEmail,
            changeMode,
            handleSubmit,
          }}
        />
      )}
    </div>
  );
}

function LoginCardHeading({
  mode,
  complete,
  definingPassword,
}: {
  mode: LoginMode;
  complete: boolean;
  definingPassword: boolean;
}): ReactNode {
  let heading = title(mode);
  if (complete) heading = definingPassword ? "Senha salva." : "Confira seu email.";
  return (
    <h2
      key={`title-${complete ? "complete" : mode}`}
      className={styles.accessTitle}
      id="login-title"
    >
      {heading}
    </h2>
  );
}

type LoginMethodsProps = Pick<
  LoginCardViewProps,
  | "mode"
  | "email"
  | "pending"
  | "error"
  | "invalidReset"
  | "definingPassword"
  | "requestMode"
  | "setEmail"
  | "changeMode"
  | "handleSubmit"
>;

function LoginCardMethods({
  mode,
  email,
  pending,
  error,
  invalidReset,
  definingPassword,
  requestMode,
  setEmail,
  changeMode,
  handleSubmit,
}: LoginMethodsProps): ReactNode {
  return (
    <>
      <p key={`description-${mode}`} className={styles.accessDescription}>
        {DESCRIPTION[mode]}
      </p>
      <div key={`methods-${mode}`} className={styles.methods}>
        <div className={styles.controlStack}>
          {invalidReset ? (
            <InvalidResetNotice onRequest={() => changeMode(requestMode)} />
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
  );
}

function InvalidResetNotice({ onRequest }: { onRequest: () => void }): ReactNode {
  return <Button onClick={onRequest}>Solicitar novo link</Button>;
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
  const saved = mode === "reset" || mode === SET_PASSWORD_MODE;
  const passwordEmail = mode === "recover" || mode === "register";
  return (
    <div className={styles.sent} role="status" tabIndex={-1}>
      <div className={styles.sentMark} aria-hidden="true">
        {saved ? <Check /> : <MailCheck />}
      </div>
      <p className="text-body leading-relaxed">
        <CompleteMessage mode={mode} email={email} />
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

function CompleteMessage({ mode, email }: { mode: LoginMode; email: string }): ReactNode {
  if (mode === "reset" || mode === SET_PASSWORD_MODE)
    return "Tudo pronto. Entre com seu email e sua nova senha.";
  if (mode === "recover" || mode === "register")
    return (
      <>
        Se <strong>{email}</strong> tiver acesso à Lazuli, você receberá um link para{" "}
        {mode === "register" ? "cadastrar" : "recuperar"} sua senha.
      </>
    );
  return (
    <>
      Se <strong>{email}</strong> tiver acesso à Lazuli, você receberá um link para entrar.
    </>
  );
}
