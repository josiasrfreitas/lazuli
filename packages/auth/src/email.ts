import { createEmailSender } from "@lazuli/integrations";

import type { AuthEnvironment } from "./env.js";
import type { MagicLinkSender } from "./auth-options.js";

import { createMagicLinkEmail } from "./magic-link-email.js";

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
