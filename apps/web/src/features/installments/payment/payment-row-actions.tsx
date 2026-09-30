import { useState, type ReactElement } from "react";
import { Ellipsis } from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@lazuli/ui";
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
  const [open, setOpen] = useState(false);
  const locked = state.submitting || state.uncertain;
  const act = (action: () => void): void => {
    action();
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={locked}
        aria-label={`Ações da parcela ${item.row.sequenceNumber} de ${item.row.payer.name}`}
        render={
          <Button type="button" size="icon-sm" className="size-11 sm:size-8" variant="ghost" />
        }
      >
        <Ellipsis aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" size="sm" showArrow={false} className="grid gap-1">
        <PopoverTitle className="sr-only">Ações da parcela</PopoverTitle>
        <Button
          type="button"
          variant="ghost"
          disabled={locked}
          className="justify-start"
          onClick={() => act(() => setDetails(!details))}
        >
          {details ? "Ocultar detalhes" : "Ver detalhes e alocação"}
        </Button>
        <ReceiptMutationActions item={item} state={state} act={act} />
      </PopoverContent>
    </Popover>
  );
}

function ReceiptMutationActions({
  item,
  state,
  act,
}: {
  item: DraftItem;
  state: PaymentFormState;
  act: (action: () => void) => void;
}): ReactElement {
  const locked = state.submitting || state.uncertain;
  const canSplit = state.draft.items.filter((row) => row.receiptId === item.receiptId).length > 1;
  return (
    <>
      {canSplit && (
        <Button
          type="button"
          variant="ghost"
          disabled={locked}
          className="justify-start"
          onClick={() =>
            act(() =>
              state.dispatch({
                type: "split",
                id: item.row.installmentId,
                receiptId: crypto.randomUUID(),
              }),
            )
          }
        >
          Separar recebimento
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        disabled={locked}
        className="justify-start"
        onClick={() => act(() => state.dispatch({ type: "remove", id: item.row.installmentId }))}
      >
        Remover recebível
      </Button>
    </>
  );
}
