import { createHash } from "node:crypto";
/** Detect changes to the installment schedule as well as to the final amount. */
export function materialPriceVersion(
  installments: number,
  installmentCents: number,
  cardFeePct: number,
): string {
  return createHash("sha256")
    .update(JSON.stringify(["single-receipt-v1", installments, installmentCents, cardFeePct]))
    .digest("hex");
}
