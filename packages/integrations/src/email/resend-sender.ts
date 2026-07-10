import { Resend } from "resend";

import type { EmailSender } from "./sender.js";
import { requireEmailBody } from "./sender.js";

export type ResendEmailSenderConfig = {
  apiKey: string;
  from: string;
};

export class ResendSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResendSendError";
  }
}

export function createResendEmailSender(config: ResendEmailSenderConfig): EmailSender {
  const resend = new Resend(config.apiKey);

  return {
    send: async (input) => {
      const body = requireEmailBody(input);
      const { error } = await resend.emails.send({
        from: config.from,
        to: input.to,
        subject: input.subject,
        ...body,
      });

      if (error !== null) {
        throw new ResendSendError(`${error.name}: ${error.message}`);
      }
    },
  };
}
