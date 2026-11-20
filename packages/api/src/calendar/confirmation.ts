import { TRPCError } from "@trpc/server";

export function calendarConfirmationPhrase(total: number): string | null {
  if (total === 0) return null;
  return `CONFIRMO O CANCELAMENTO DE ${total} ${total === 1 ? "ATIVIDADE" : "ATIVIDADES"}`;
}

export function requireCalendarConfirmation(phrase: string | null, value?: string): void {
  if (phrase && value?.trim().toLocaleUpperCase("pt-BR") !== phrase)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Digite a confirmação de cancelamento exatamente como aparece na prévia.",
    });
}
