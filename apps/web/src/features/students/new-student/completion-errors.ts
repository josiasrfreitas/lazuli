const BUSINESS_ERRORS = new Set(["BAD_REQUEST", "NOT_FOUND", "CONFLICT", "PRECONDITION_FAILED"]);

export function completionErrorMessage(error: {
  message: string;
  data?: { code: string } | null | undefined;
}): string {
  if (error.data && BUSINESS_ERRORS.has(error.data.code)) return error.message;
  return "Não foi possível concluir o cadastro. Seus dados foram mantidos; tente novamente.";
}
