import type { ReactElement } from "react";
import {
  Field,
  FieldError,
  FormRow,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lazuli/ui";
import { paymentMethodSchema } from "@lazuli/validators";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import type { PaymentFormState } from "./logic";
const METHOD_LABELS = {
  PIX: "PIX",
  CASH: "Dinheiro",
  TRANSFER: "Transferência",
  CARD: "Cartão",
  CHEQUE: "Cheque",
  BOLETO: "Boleto",
  OTHER: "Outro",
};
export function PaymentFields({ state }: { state: PaymentFormState }): ReactElement {
  const invalid = state.revision > 0 && !parseDateBR(state.draft.date);
  return (
    <FormRow className="grid-cols-[minmax(0,9rem)_minmax(0,1fr)] sm:grid-cols-[9rem_12rem_minmax(0,1fr)]">
      <Field>
        <Label>Data do recebimento</Label>
        <Input
          name="date"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          inputMode="numeric"
          size="sm"
          className="h-11 font-numeric text-base sm:h-control-sm sm:text-control"
          value={state.draft.date}
          invalid={invalid}
          onChange={(event) =>
            state.dispatch({ type: "date", value: maskDateBR(event.target.value) })
          }
        />
        {invalid && <FieldError match>Informe uma data válida.</FieldError>}
      </Field>
      <PaymentMethod state={state} />
      <p className="col-span-2 text-caption text-muted-foreground sm:col-span-1 sm:self-end">
        Juros e descontos calculados na data do recebimento.
      </p>
    </FormRow>
  );
}

function PaymentMethod({ state }: { state: PaymentFormState }): ReactElement {
  return (
    <Field>
      <Label id="payment-method-label">Forma de pagamento</Label>
      <Select
        value={state.draft.method}
        onValueChange={(value) => {
          const parsed = paymentMethodSchema.safeParse(value);
          if (parsed.success) state.dispatch({ type: "method", value: parsed.data });
        }}
      >
        <SelectTrigger
          size="sm"
          className="h-11 text-base sm:h-control-sm sm:text-control"
          aria-labelledby="payment-method-label"
        >
          <SelectValue>{METHOD_LABELS[state.draft.method]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {paymentMethodSchema.options.map((method) => (
            <SelectItem key={method} value={method}>
              {METHOD_LABELS[method]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
