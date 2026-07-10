export type EmailSendInput = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

export type EmailSender = {
  send(input: EmailSendInput): Promise<void>;
};

export type EmailBody = { html: string; text?: string } | { text: string; html?: string };

export class EmailBodyMissingError extends Error {
  constructor() {
    super("Email requires at least one of html or text");
    this.name = "EmailBodyMissingError";
  }
}

export function requireEmailBody(input: EmailSendInput): EmailBody {
  if (input.html !== undefined) {
    return input.text === undefined ? { html: input.html } : { html: input.html, text: input.text };
  }

  if (input.text !== undefined) {
    return { text: input.text };
  }

  throw new EmailBodyMissingError();
}

export function createNoOpEmailSender(): EmailSender {
  return {
    send: () => Promise.resolve(),
  };
}
