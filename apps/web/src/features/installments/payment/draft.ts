import type { RouterOutputs } from "@lazuli/api";
import type { FinanceInstallmentRow, PaymentOperationInput } from "@lazuli/validators";
import { formatDateOnlyBR } from "~/lib/format";
import { parseDateBR } from "~/lib/masks";

export type PreviewRow = RouterOutputs["finance"]["previewPayments"][number];
export type DraftItem = {
  row: FinanceInstallmentRow;
  receiptId: string;
  amount: number | null | undefined;
};
export type PaymentDraft = {
  date: string;
  method: PaymentOperationInput["method"];
  items: DraftItem[];
  totals: Record<string, number | null>;
};
export type DraftAction =
  | { type: "add"; row: FinanceInstallmentRow; receiptId: string }
  | { type: "remove"; id: string }
  | { type: "amount"; id: string; value: number | null }
  | { type: "split"; id: string; receiptId: string }
  | { type: "total"; id: string; value: number | null }
  | { type: "date"; value: string }
  | { type: "method"; value: PaymentDraft["method"] };

export function paymentDraftReducer(state: PaymentDraft, action: DraftAction): PaymentDraft {
  switch (action.type) {
    case "date": {
      return { ...state, date: action.value };
    }
    case "method": {
      return { ...state, method: action.value };
    }
    case "total": {
      return { ...state, totals: { ...state.totals, [action.id]: action.value } };
    }
    case "remove": {
      return {
        ...state,
        items: state.items.filter((item) => item.row.installmentId !== action.id),
      };
    }
    case "amount": {
      return {
        ...state,
        items: state.items.map((item) =>
          item.row.installmentId === action.id ? { ...item, amount: action.value } : item,
        ),
      };
    }
    case "split": {
      return {
        ...state,
        items: state.items.map((item) =>
          item.row.installmentId === action.id ? { ...item, receiptId: action.receiptId } : item,
        ),
      };
    }
    case "add": {
      return addDraftItem(state, action);
    }
  }
}
function addDraftItem(
  state: PaymentDraft,
  action: Extract<DraftAction, { type: "add" }>,
): PaymentDraft {
  if (state.items.some((item) => item.row.installmentId === action.row.installmentId)) return state;
  const existing = state.items.find((item) => item.row.payer.id === action.row.payer.id);
  return {
    ...state,
    items: [
      ...state.items,
      { row: action.row, receiptId: existing?.receiptId ?? action.receiptId, amount: undefined },
    ],
  };
}
export function initialPaymentDraft(rows: FinanceInstallmentRow[], date: string): PaymentDraft {
  let state: PaymentDraft = { date, method: "PIX", items: [], totals: {} };
  for (const row of rows)
    state = paymentDraftReducer(state, { type: "add", row, receiptId: crypto.randomUUID() });
  return state;
}
export function draftReceipts(
  draft: PaymentDraft,
  preview: PreviewRow[],
): PaymentOperationInput["receipts"] {
  const receipts = new Map<string, PaymentOperationInput["receipts"][number]>();
  for (const item of draft.items) {
    const line = preview.find((row) => row.installmentId === item.row.installmentId)?.line;
    const receipt = receipts.get(item.receiptId) ?? {
      commandId: item.receiptId,
      payerId: item.row.payer.id,
      amountCents: 0,
      allocations: [],
    };
    const amountCents =
      item.amount === undefined ? (line?.quote.receivedCents ?? 0) : (item.amount ?? 0);
    receipt.allocations.push({
      installmentId: item.row.installmentId,
      amountCents,
      version: line?.version ?? "",
    });
    receipt.amountCents += amountCents;
    receipts.set(item.receiptId, receipt);
  }
  return [...receipts.values()].map((receipt) => ({
    ...receipt,
    amountCents:
      draft.totals[receipt.commandId] === undefined
        ? receipt.amountCents
        : (draft.totals[receipt.commandId] ?? 0),
  }));
}
export function paymentDraftError(draft: PaymentDraft, preview: PreviewRow[]): string | null {
  if (!parseDateBR(draft.date)) return "Informe uma data válida.";
  if (draft.items.length === 0) return "Adicione ao menos um recebível.";
  for (const item of draft.items) {
    const error = itemError(item, preview);
    if (error) return error;
  }
  for (const receipt of draftReceipts(draft, preview)) {
    if (receipt.amountCents !== receipt.allocations.reduce((sum, row) => sum + row.amountCents, 0))
      return "Confira o total recebido: deve coincidir com a soma das parcelas.";
  }
  return null;
}

function itemError(item: DraftItem, preview: PreviewRow[]): string | null {
  const row = preview.find((entry) => entry.installmentId === item.row.installmentId);
  if (!row?.line) return row?.error ?? "Aguarde a prévia de todas as parcelas.";
  const amount = item.amount === undefined ? row.line.quote.receivedCents : (item.amount ?? 0);
  if (amount <= 0 || amount > row.line.quote.settlementCents)
    return `Parcela ${item.row.installmentId}: informe um valor positivo até a quitação.`;
  return null;
}
export function paymentDateLabel(date: string): string {
  return formatDateOnlyBR(date);
}
