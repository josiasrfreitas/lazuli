import type { ReactElement } from "react";
import {
  Field,
  FieldError,
  FormRow,
  FormSection,
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
    <FormSection title="Dados do recebimento">
      <FormRow columns={2}>
        <Field>
          <Label>Data efetiva</Label>
          <Input
            name="date"
            autoComplete="off"
            placeholder="dd/mm/aaaa"
            inputMode="numeric"
            size="sm"
            value={state.draft.date}
            invalid={invalid}
            onChange={(event) =>
              state.dispatch({ type: "date", value: maskDateBR(event.target.value) })
            }
          />
          {invalid && <FieldError match>Informe uma data válida.</FieldError>}
        </Field>
        <Field>
          <Label id="payment-method-label">Forma de pagamento</Label>
          <Select
            value={state.draft.method}
            onValueChange={(value) => {
              const parsed = paymentMethodSchema.safeParse(value);
              if (parsed.success) state.dispatch({ type: "method", value: parsed.data });
            }}
          >
            <SelectTrigger size="sm" aria-labelledby="payment-method-label">
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
      </FormRow>
    </FormSection>
  );
}
