import nodemailer from "nodemailer";
import { Resend } from "resend";

import type { AuthEnvironment } from "./env.js";
import type { MagicLinkDelivery, MagicLinkSender } from "./auth-options.js";

export function createMagicLinkSender(environment: AuthEnvironment): MagicLinkSender {
  if (environment.resendApiKey !== undefined) {
    const resend = new Resend(environment.resendApiKey);

    return async (delivery) => {
      await resend.emails.send({
        from: environment.emailFrom,
        to: delivery.email,
        subject: "Seu link de acesso ao Lazuli",
        text: createMagicLinkEmailText(delivery),
      });
    };
  }

  const transporter = nodemailer.createTransport({
    host: environment.smtpHost,
    port: environment.smtpPort,
    secure: false,
  });

  return async (delivery) => {
    await transporter.sendMail({
      from: environment.emailFrom,
      to: delivery.email,
      subject: "Seu link de acesso ao Lazuli",
      text: createMagicLinkEmailText(delivery),
    });
  };
}

function createMagicLinkEmailText(delivery: MagicLinkDelivery): string {
  return `Use este link para acessar o Lazuli:\n\n${delivery.url}`;
}
