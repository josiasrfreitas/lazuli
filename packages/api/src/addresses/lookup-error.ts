import { safeError } from "@lazuli/logging";

export function addressLookupError(
  error: Parameters<typeof safeError>[0],
  localProfile?: string,
): { details: ReturnType<typeof safeError>; message: string } {
  const details = safeError(error);
  if (!(error instanceof Error) || error.name !== "CredentialsProviderError")
    return { details, message: "Address lookup failed" };

  const expired = error.message.includes("Your session has expired");
  const message = expired
    ? "Amazon Location: a sessão AWS expirou."
    : "Amazon Location: credenciais AWS indisponíveis.";
  return {
    details: { ...details, error_stack: undefined },
    message:
      expired && localProfile === "lazuli"
        ? message + " Execute aws login --profile lazuli."
        : message + " Confira a autenticação do serviço.",
  };
}
