import nodemailer from "nodemailer";

import type { EmailSender } from "./sender.js";
import { requireEmailBody } from "./sender.js";

export type SmtpEmailSenderConfig = {
  host: string;
  port: number;
  from: string;
};

export function createSmtpEmailSender(config: SmtpEmailSenderConfig): EmailSender {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
  });

  return {
    send: async (input) => {
      const body = requireEmailBody(input);
      await transporter.sendMail({
        from: config.from,
        to: input.to,
        subject: input.subject,
        ...body,
      });
    },
  };
}
