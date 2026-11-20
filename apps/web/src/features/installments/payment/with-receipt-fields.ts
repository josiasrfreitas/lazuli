import type { PaymentDraft } from "./draft";
import type { PaymentProofDrafts } from "./payment-proof";

export function withReceiptFields(draft: PaymentDraft, proofs: PaymentProofDrafts): PaymentDraft {
  const receiptIds = new Set(draft.items.map((item) => item.receiptId));
  const dates = new Set([...receiptIds].map((id) => proofs[id]?.fields?.date));
  const [date] = dates;
  const counts = new Map<string, number>();
  for (const item of draft.items) counts.set(item.receiptId, (counts.get(item.receiptId) ?? 0) + 1);
  return {
    ...draft,
    date: !draft.dateEdited && dates.size === 1 && date ? date : draft.date,
    items: draft.items.map((item) => {
      const cents = proofs[item.receiptId]?.fields?.cents;
      if (item.amount !== undefined || !cents || counts.get(item.receiptId) !== 1) return item;
      return { ...item, amount: cents };
    }),
  };
}
