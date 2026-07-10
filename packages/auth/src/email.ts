import type { EmailSender } from "@lazuli/integrations";
import { createResendEmailSender, createSmtpEmailSender } from "@lazuli/integrations";

import type { AuthEnvironment } from "./env.js";
import type { MagicLinkDelivery, MagicLinkSender } from "./auth-options.js";

export function createMagicLinkSender(environment: AuthEnvironment): MagicLinkSender {
  const sender = createEmailSender(environment);

  return async (delivery) => {
    await sender.send({
      to: delivery.email,
      subject: "Seu link de acesso ao Lazuli",
      text: createMagicLinkEmailText(delivery),
    });
  };
}

function createEmailSender(environment: AuthEnvironment): EmailSender {
  if (environment.resendApiKey !== undefined) {
    return createResendEmailSender({
      apiKey: environment.resendApiKey,
      from: environment.emailFrom,
    });
  }

  return createSmtpEmailSender({
    host: environment.smtpHost,
    port: environment.smtpPort,
    from: environment.emailFrom,
  });
}

function createMagicLinkEmailText(delivery: MagicLinkDelivery): string {
  return `Use este link para acessar o Lazuli:\n\n${delivery.url}`;
}
