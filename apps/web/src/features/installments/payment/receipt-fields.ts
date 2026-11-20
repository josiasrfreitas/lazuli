import { parseDateBR } from "~/lib/masks";

export type ReceiptFields = { date?: string; cents?: number };

const paidAmount =
  /^(?:valor (?:total pago|pago|recebido|transferido|enviado|do (?:pagamento|pix)|da (?:transacao|transferencia))|total pago|valor)\s*[:\-]?\s*(?:r\$\s*)?((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})$/;
const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function normalizeDate(line: string): string {
  return line.replace(
    /(\d{1,2})\s+(?:de )?([a-z]{3,9})\.?\s+(?:de )?(\d{4})\b/,
    (original: string, day: string, month: string, year: string) => {
      const index = months.indexOf(month.slice(0, 3));
      return index < 0 ? original : `${day}/${index + 1}/${year}`;
    },
  );
}
const paidDate =
  /^(?:data(?: e hora)?(?: (?:do (?:pagamento|pix)|da (?:transacao|transferencia|efetivacao)))?|pago em|realizado em|efetuado em)\s*[:\-]?\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[, ]+ *(?:as\s+)?\d{1,2}:\d{2}(?::\d{2})?)?$/;

export function parseReceipt(text: string): ReceiptFields {
  const lines = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  if (
    lines.some((line) =>
      /\b(?:agendad[oa]|agendamento|cancelad[oa]|pendente|estornad[oa]|nao efetuad[oa])\b/.test(
        line,
      ),
    )
  )
    return {};
  const dates = new Set<string>();
  const amounts = new Set<number>();
  const genericAmounts = new Set<number>();
  for (const [index, line] of lines.entries()) {
    for (const candidate of [line, line + " " + (lines[index + 1] ?? "")]) {
      const value = paidAmount.exec(candidate)?.[1];
      if (value) {
        const cents = Number(value.replace(/[.,]/g, ""));
        if (Number.isSafeInteger(cents) && cents > 0)
          (/^valor\s*[:\-]?\s*(?:r\$|\d)/.test(candidate) ? genericAmounts : amounts).add(cents);
      }
      const match = paidDate.exec(normalizeDate(candidate));
      if (match) {
        const date = [match[1]?.padStart(2, "0"), match[2]?.padStart(2, "0"), match[3]].join("/");
        if (parseDateBR(date)) dates.add(date);
      }
    }
  }
  const [date] = dates;
  const selectedAmounts = amounts.size ? amounts : genericAmounts;
  const [cents] = selectedAmounts;
  return {
    ...(dates.size === 1 && date ? { date } : {}),
    ...(selectedAmounts.size === 1 && cents ? { cents } : {}),
  };
}
