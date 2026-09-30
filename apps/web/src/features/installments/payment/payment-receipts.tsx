import { useId, type ReactElement, type ReactNode } from "react";
import { formatBRLFromCents as money } from "~/lib/format";
import { originLabel } from "../view-model";
import { draftReceipts, type DraftItem } from "./draft";
import type { PaymentFormState } from "./logic";

export function PaymentAllocation({
  item,
  state,
}: {
  item: DraftItem;
  state: PaymentFormState;
}): ReactElement {
  const receipt = draftReceipts(state.draft, state.preview).find(
    (entry) => entry.commandId === item.receiptId,
  );
  const items = state.draft.items.filter((entry) => entry.receiptId === item.receiptId);
  return (
    <div className="space-y-2 border-t border-border pt-3 text-caption text-muted-foreground">
      <p>Pagador: {item.row.payer.name}</p>
      <p>Recebido anteriormente nesta parcela: {money(item.row.paidAmountCents)}</p>
      {items.length > 1 && (
        <>
          <p>Parcelas no mesmo recebimento:</p>
          <ul className="space-y-1">
            {items.map((entry) => (
              <li key={entry.row.installmentId} className="flex justify-between gap-3">
                <span>
                  {entry.row.beneficiaries.map((person) => person.fullName).join(", ")}
                  {" · "}
                  {originLabel(entry.row.origin)} {entry.row.sequenceNumber}/
                  {entry.row.scheduleTotal}
                </span>
                <span className="shrink-0 font-numeric">
                  {money(
                    receipt?.allocations.find(
                      (allocation) => allocation.installmentId === entry.row.installmentId,
                    )?.amountCents ?? 0,
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p>O saldo considera os encargos novos e o desconto elegível na data efetiva.</p>
    </div>
  );
}

export function PaymentReceiptGroup({
  items,
  total,
  children,
}: {
  items: DraftItem[];
  total: number;
  children: ReactNode;
}): ReactElement {
  const id = useId();
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-md border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/50 px-3 py-2">
        <div className="min-w-0">
          <p className="text-caption text-muted-foreground">Pagador</p>
          <h3 id={id} className="break-words text-control font-semibold">
            {items[0]?.row.payer.name}
          </h3>
        </div>
        <div className="shrink-0 text-right">
          <p className="max-w-32 text-caption text-muted-foreground sm:max-w-none">
            {items.length} {items.length === 1 ? "parcela" : "parcelas"} · 1 recebimento
          </p>
          <p className="font-numeric text-control font-medium">{money(total)}</p>
        </div>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}
