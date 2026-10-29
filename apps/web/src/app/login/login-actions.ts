import { authClient } from "~/lib/auth-client";

import type { LoginMode } from "./login-form";

const DENIED_MESSAGE = "Acesso não autorizado. Fale com a secretaria.";

/** Errors never reveal whether the supplied credentials belong to a staff member. */
export async function submitLogin(
  mode: LoginMode,
  email: string,
  password: string,
  token: string | null,
): Promise<{ message: string; expired?: boolean } | null> {
  try {
    if (mode === "password") {
      const result = await authClient.signIn.email({ email, password });
      if (result.error)
        return {
          message:
            result.error.status === 429
              ? "Muitas tentativas. Aguarde um pouco e tente novamente."
              : result.error.code === "STAFF_ACCESS_DENIED"
                ? DENIED_MESSAGE
                : "Não foi possível entrar. Confira email e senha ou recupere sua senha.",
        };
      window.location.assign("/?entrada=1");
      return null;
    }
    if (mode === "magic-link") {
      const result = await authClient.signIn.magicLink({
        email,
        callbackURL: "/?entrada=1",
        errorCallbackURL: "/login",
      });
      if (result.error)
        return { message: "Não foi possível enviar o link. Tente novamente em alguns instantes." };
      return null;
    }
    if (mode === "recover" || mode === "register") {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: mode === "register" ? "/cadastrar-senha" : "/login?mode=reset",
      });
      return result.error
        ? { message: "Não foi possível enviar o link. Tente novamente em alguns instantes." }
        : null;
    }
    const result = await authClient.resetPassword({ newPassword: password, token: token ?? "" });
    if (result.error)
      return {
        expired: result.error.code === "INVALID_TOKEN",
        message:
          result.error.code === "INVALID_TOKEN"
            ? "Link inválido ou expirado. Solicite um novo link para definir sua senha."
            : result.error.code === "PASSWORD_TOO_SHORT"
              ? "Mínimo de 8 caracteres."
              : "Não foi possível salvar a senha. Tente novamente.",
      };
    window.history.replaceState(window.history.state, "", "/login");
    return null;
  } catch {
    return { message: "Não foi possível conectar. Confira sua conexão e tente novamente." };
  }
}
