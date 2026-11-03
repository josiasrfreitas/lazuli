import { createEmailSender } from "@lazuli/integrations";

import type { AuthEnvironment } from "./env.js";
import type { MagicLinkSender, PasswordResetSender } from "./auth-options.js";

import { createMagicLinkEmail } from "./magic-link-email.js";
import { createPasswordResetEmail } from "./password-reset-email.js";

export function createPasswordResetSender(environment: AuthEnvironment): PasswordResetSender {
  const sender = createEmailSender(environment);
  return async ({ email, url }) => {
    const resetUrl = new URL(url);
    const callback = resetUrl.searchParams.get("callbackURL");
    const registering =
      callback !== null && new URL(callback, environment.appUrl).pathname === "/cadastrar-senha";
    const token = resetUrl.pathname.split("/").at(-1);
    if (!token) throw new Error("Password reset URL has no token");
    const destination = new URL(
      registering ? "/cadastrar-senha" : "/login?mode=reset",
      environment.appUrl,
    );
    destination.hash = new URLSearchParams({ token }).toString();
    await sender.send({
      to: email,
      subject: registering ? "Cadastre sua senha da Lazuli" : "Recupere sua senha da Lazuli",
      ...createPasswordResetEmail(destination.toString(), registering),
    });
  };
}

export function createMagicLinkSender(environment: AuthEnvironment): MagicLinkSender {
  const sender = createEmailSender(environment);

  return async (delivery) => {
    await sender.send({
      to: delivery.email,
      subject: "Seu link de acesso ao Lazuli",
      ...createMagicLinkEmail(delivery.url),
    });
  };
}
