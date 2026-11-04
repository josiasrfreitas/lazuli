import { authClient } from "~/lib/auth-client";

import type { LoginMode } from "./login-form";

const DENIED_MESSAGE = "Acesso não autorizado. Fale com a secretaria.";
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_UNAUTHORIZED = 401;
const LINK_SEND_ERROR = "Não foi possível enviar o link. Tente novamente em alguns instantes.";

type LoginFailure = { message: string; expired?: boolean };
type LoginInput = { mode: LoginMode; email: string; password: string; token: string | null };

function passwordError(error: {
  status?: number | undefined;
  code?: string | undefined;
}): LoginFailure {
  if (error.status === HTTP_TOO_MANY_REQUESTS)
    return { message: "Muitas tentativas. Aguarde um pouco e tente novamente." };
  if (error.code === "STAFF_ACCESS_DENIED") return { message: DENIED_MESSAGE };
  if (error.status === HTTP_UNAUTHORIZED || error.code === "INVALID_EMAIL_OR_PASSWORD")
    return { message: "Email ou senha incorretos. Confira os dados e tente novamente." };
  return { message: "Não foi possível entrar agora. Tente novamente em instantes." };
}

async function signInWithPassword(email: string, password: string): Promise<LoginFailure | null> {
  const result = await authClient.signIn.email({ email, password });
  if (result.error) return passwordError(result.error);
  globalThis.location.assign("/?entrada=1");
  return null;
}

async function sendMagicLink(email: string): Promise<LoginFailure | null> {
  const result = await authClient.signIn.magicLink({
    email,
    callbackURL: "/?entrada=1",
    errorCallbackURL: "/login",
  });
  return result.error ? { message: LINK_SEND_ERROR } : null;
}

async function requestPasswordLink(mode: LoginMode, email: string): Promise<LoginFailure | null> {
  const result = await authClient.requestPasswordReset({
    email,
    redirectTo: mode === "register" ? "/cadastrar-senha" : "/login?mode=reset",
  });
  return result.error ? { message: LINK_SEND_ERROR } : null;
}

function resetPasswordError(code: string | undefined): LoginFailure {
  if (code === "INVALID_TOKEN")
    return {
      expired: true,
      message: "Link inválido ou expirado. Solicite um novo link para definir sua senha.",
    };
  if (code === "PASSWORD_TOO_SHORT") return { message: "Mínimo de 8 caracteres." };
  return { message: "Não foi possível salvar a senha. Tente novamente." };
}

async function savePassword(password: string, token: string | null): Promise<LoginFailure | null> {
  const result = await authClient.resetPassword({ newPassword: password, token: token ?? "" });
  if (result.error) return resetPasswordError(result.error.code);
  globalThis.history.replaceState(globalThis.history.state, "", "/login");
  return null;
}

/** Errors never reveal whether the supplied credentials belong to a staff member. */
export async function submitLogin({
  mode,
  email,
  password,
  token,
}: LoginInput): Promise<LoginFailure | null> {
  try {
    if (mode === "password") return await signInWithPassword(email, password);
    if (mode === "magic-link") return await sendMagicLink(email);
    if (mode === "recover" || mode === "register") return await requestPasswordLink(mode, email);
    return await savePassword(password, token);
  } catch {
    return { message: "Não foi possível conectar. Confira sua conexão e tente novamente." };
  }
}
