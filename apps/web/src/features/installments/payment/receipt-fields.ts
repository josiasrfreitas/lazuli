import { parseDateBR } from "~/lib/masks";

export type ReceiptFields = { date?: string; cents?: number };

const paidAmount =
  /^(?:valor (?:total pago|pago|recebido|transferido|enviado|do (?:pagamento|pix)|da (?:transacao|transferencia))|total pago|valor)\s*[:-]?\s*(?:r\$\s*)?((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})$/;
const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTH_PREFIX_LENGTH = 3;
const naturalDate = /(\d{1,2})\s+(?:de )?([a-z]{3,9})\.?\s+(?:de )?(\d{4})\b/;
function normalizeDate(line: string): string {
  const match = naturalDate.exec(line);
  if (!match) return line;
  const [original, day, month, year] = match;
  const index = months.indexOf(month!.slice(0, MONTH_PREFIX_LENGTH));
  return index === -1 ? line : line.replace(original, `${day}/${index + 1}/${year}`);
}
const paidDate =
  /^(?:data(?: e hora)?(?: (?:do (?:pagamento|pix)|da (?:transacao|transferencia|efetivacao)))?|pago em|realizado em|efetuado em)\s*[:-]?\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[, ]+ *(?:as\s+)?\d{1,2}:\d{2}(?::\d{2})?)?$/;

export function parseReceipt(text: string): ReceiptFields {
  const lines = text
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .split(/\r?\n/)
    .map((line) => line.trim().replaceAll(/\s+/g, " "))
    .filter(Boolean);
  if (
    lines.some((line) =>
      /\b(?:agendad[oa]|agendamento|cancelad[oa]|pendente|estornad[oa]|nao efetuad[oa])\b/.test(
        line,
      ),
    )
  )
    return {};
  const { dates, amounts, genericAmounts } = readCandidates(lines);
  const [date] = dates;
  const selectedAmounts = amounts.size > 0 ? amounts : genericAmounts;
  const [cents] = selectedAmounts;
  return {
    ...(dates.size === 1 ? { date: date! } : {}),
    ...(selectedAmounts.size === 1 ? { cents: cents! } : {}),
  };
}

function amountInLine(line: string): number | undefined {
  const value = paidAmount.exec(line)?.[1];
  if (!value) return undefined;
  const cents = Number(value.replaceAll(/[.,]/g, ""));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : undefined;
}
function dateInLine(line: string): string | undefined {
  const match = paidDate.exec(normalizeDate(line));
  if (!match) return undefined;
  const date = [match[1]!.padStart(2, "0"), match[2]!.padStart(2, "0"), match[3]].join("/");
  return parseDateBR(date) ? date : undefined;
}

function readCandidates(lines: string[]): {
  dates: Set<string>;
  amounts: Set<number>;
  genericAmounts: Set<number>;
} {
  const dates = new Set<string>();
  const amounts = new Set<number>();
  const genericAmounts = new Set<number>();
  for (const [index, line] of lines.entries()) {
    for (const candidate of [line, line + " " + (lines[index + 1] ?? "")]) {
      const cents = amountInLine(candidate);
      if (cents !== undefined) {
        const values = /^valor\s*[:-]?\s*(?:r\$|\d)/.test(candidate) ? genericAmounts : amounts;
        values.add(cents);
      }
      const date = dateInLine(candidate);
      if (date) dates.add(date);
    }
  }
  return { dates, amounts, genericAmounts };
}
