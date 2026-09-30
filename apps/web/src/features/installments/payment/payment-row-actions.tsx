import type { ReactElement } from "react";
import { ChevronDown, Split, X } from "lucide-react";
import { Button } from "@lazuli/ui";
import type { DraftItem } from "./draft";
import type { PaymentFormState } from "./logic";
export function PaymentRowActions({
  item,
  state,
  details,
  setDetails,
}: {
  item: DraftItem;
  state: PaymentFormState;
  details: boolean;
  setDetails: (value: boolean) => void;
}): ReactElement {
  const canSplit = state.draft.items.filter((row) => row.receiptId === item.receiptId).length > 1;
  return (
    <div className="mt-1 flex gap-1">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        title="Detalhes"
        aria-label={`Detalhes da parcela ${item.row.sequenceNumber}`}
        aria-expanded={details}
        onClick={() => setDetails(!details)}
      >
        <ChevronDown aria-hidden="true" />
      </Button>
      {canSplit && <SplitReceipt item={item} state={state} />}
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        title="Remover"
        aria-label={`Remover parcela ${item.row.sequenceNumber} de ${item.row.payer.name}`}
        onClick={() => state.dispatch({ type: "remove", id: item.row.installmentId })}
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}

function SplitReceipt({ item, state }: { item: DraftItem; state: PaymentFormState }): ReactElement {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      title="Separar recebimento"
      aria-label={`Separar recebimento da parcela ${item.row.sequenceNumber}`}
      onClick={() =>
        state.dispatch({
          type: "split",
          id: item.row.installmentId,
          receiptId: crypto.randomUUID(),
        })
      }
    >
      <Split aria-hidden="true" />
    </Button>
  );
}
