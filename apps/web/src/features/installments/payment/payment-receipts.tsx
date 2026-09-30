import type { ReactElement } from "react";
import { CurrencyInput, Field, FieldError, FormSection, Label } from "@lazuli/ui";
import { formatBRLFromCents as money } from "~/lib/format";
import { draftReceipts } from "./draft";
import type { PaymentFormState } from "./logic";
export function PaymentReceipts({ state }: { state: PaymentFormState }): ReactElement {
  const receipts = draftReceipts(state.draft, state.preview);
  return (
    <FormSection title="Recebimentos · confira os totais">
      {receipts.map((receipt, index) => {
        const payer = state.draft.items.find((item) => item.receiptId === receipt.commandId)?.row
          .payer.name;
        const allocated = receipt.allocations.reduce((sum, row) => sum + row.amountCents, 0);
        const invalid = receipt.amountCents !== allocated;
        return (
          <div
            key={receipt.commandId}
            className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]"
          >
            <div className="min-w-0 break-words text-caption">
              <p>
                Recebimento {index + 1} · {payer}
              </p>
              <p className="text-muted-foreground">Alocado nas parcelas: {money(allocated)}</p>
            </div>
            <Field>
              <Label className="sr-only">Total efetivamente recebido</Label>
              <CurrencyInput
                name={`total-${receipt.commandId}`}
                autoComplete="off"
                placeholder="R$ 0,00"
                size="sm"
                value={state.draft.totals[receipt.commandId] === null ? null : receipt.amountCents}
                invalid={invalid}
                onValueChange={(value) =>
                  state.dispatch({ type: "total", id: receipt.commandId, value })
                }
              />
              {invalid && <FieldError match>O total deve coincidir com as parcelas.</FieldError>}
            </Field>
          </div>
        );
      })}
    </FormSection>
  );
}
