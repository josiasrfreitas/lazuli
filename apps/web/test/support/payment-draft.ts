import type { FinanceInstallmentRow } from "@lazuli/validators";
import type { PaymentDraft, PreviewRow } from "../../src/features/installments/payment/draft.js";
export const PAYMENT_ROW: FinanceInstallmentRow = {
  installmentId: "15300000-0000-4000-8000-000000000001",
  orderId: "15300000-0000-4000-8000-000000000002",
  origin: "TUITION",
  sequenceNumber: 1,
  scheduleTotal: 12,
  payer: { id: "15300000-0000-4000-8000-000000000003", name: "Pagador homônimo" },
  beneficiaries: [
    { studentId: "15300000-0000-4000-8000-000000000004", fullName: "Ana Maria Nome Longo" },
  ],
  dueDate: "2026-09-30",
  originalAmountCents: 25_000,
  expectedAmountCents: 25_000,
  paidAmountCents: 0,
  collectibleBalanceCents: 25_000,
  onTimeAmountCents: 23_000,
  status: "UPCOMING",
  overdueDays: 0,
};
export const PAYMENT_DRAFT: PaymentDraft = {
  date: "29/09/2026",
  method: "PIX",
  totals: {},
  items: [{ row: PAYMENT_ROW, receiptId: "receipt-one", amount: undefined }],
};
export const PAYMENT_PREVIEW: PreviewRow[] = [
  {
    installmentId: PAYMENT_ROW.installmentId,
    error: null,
    line: {
      installmentId: PAYMENT_ROW.installmentId,
      payerId: PAYMENT_ROW.payer.id,
      version: "version-one",
      quote: {
        balanceCents: 25_000,
        newInterestCents: 0,
        discountCents: 2000,
        settlementCents: 23_000,
        receivedCents: 23_000,
        remainingCents: 0,
      },
    },
  },
];
