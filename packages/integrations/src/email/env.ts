import { z } from "zod";

const DEFAULT_SMTP_HOST = "localhost";
const DEFAULT_SMTP_PORT = 1025;

/** Treats empty/whitespace-only values as absent so `RESEND_API_KEY=` selects SMTP. */
const optionalTrimmedString = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
  });

const emailEnvironmentSchema = z.object({
  RESEND_API_KEY: optionalTrimmedString,
  EMAIL_FROM: z.string().trim().min(1, "EMAIL_FROM is required"),
  SMTP_HOST: optionalTrimmedString,
  SMTP_PORT: optionalTrimmedString.pipe(
    z.coerce.number().int().positive("SMTP_PORT must be a positive integer").optional(),
  ),
});

export type EmailEnvironment = {
  resendApiKey: string | undefined;
  emailFrom: string;
  smtpHost: string;
  smtpPort: number;
};

export function parseEmailEnvironment(
  source?: Record<string, string | undefined>,
): EmailEnvironment {
  const parsed = emailEnvironmentSchema.parse(source ?? process.env);

  return {
    resendApiKey: parsed.RESEND_API_KEY,
    emailFrom: parsed.EMAIL_FROM,
    smtpHost: parsed.SMTP_HOST ?? DEFAULT_SMTP_HOST,
    smtpPort: parsed.SMTP_PORT ?? DEFAULT_SMTP_PORT,
  };
}
