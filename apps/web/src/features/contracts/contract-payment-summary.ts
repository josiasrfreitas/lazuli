import { formatBRLFromCents } from "~/lib/format";

export function paymentPlanLabel(count: number, uniformAmountCents: number | null): string {
  return uniformAmountCents === null
    ? `${count} parcelas · valores variáveis`
    : `${count} × ${formatBRLFromCents(uniformAmountCents)}`;
}
