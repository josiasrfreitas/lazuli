"use client";

import { Check, ChevronDown, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from "react";
import {
  capitalizePaymentMethodName,
  financeCreatePaymentMethodInputSchema,
  MAX_PAYMENT_METHOD_NAME_LENGTH,
} from "@lazuli/validators";
import {
  Button,
  Field,
  FieldError,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { PaymentFormState } from "./logic";

const usePaymentMethodField = (state: PaymentFormState) => {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const utils = trpc.useUtils();
  const create = trpc.finance.createPaymentMethod.useMutation();
  const selected = state.methods.find((method) => method.code === state.draft.method);

  useEffect(() => {
    if (open && adding) input.current?.focus();
  }, [open, adding]);

  const close = (): void => {
    setOpen(false);
    setAdding(false);
    setName("");
    setError("");
  };
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    const parsed = financeCreatePaymentMethodInputSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Informe uma forma de pagamento.");
      return;
    }
    create.mutate(parsed.data, {
      onSuccess: (method) => {
        utils.finance.paymentMethods.setData(undefined, (current) =>
          current?.some((item) => item.code === method.code)
            ? current
            : [...(current ?? []), method],
        );
        void utils.finance.paymentMethods.invalidate();
        state.dispatch({
          type: "method",
          value: method.code,
          externalFinancing: method.allowsExternalInstallments,
        });
        close();
      },
      onError: (cause) => setError(cause.message),
    });
  };

  return {
    open,
    setOpen,
    adding,
    setAdding,
    name,
    setName,
    error,
    setError,
    input,
    inputId,
    create,
    selected,
    close,
    submit,
  };
};

type PaymentMethodModel = ReturnType<typeof usePaymentMethodField>;

export function PaymentMethodField({ state }: { state: PaymentFormState }): ReactElement {
  const model = usePaymentMethodField(state);
  return <PaymentMethodFieldView state={state} model={model} />;
}

function PaymentMethodFieldView({
  state,
  model,
}: {
  state: PaymentFormState;
  model: PaymentMethodModel;
}): ReactElement {
  const { open, setOpen, create, selected, close } = model;

  return (
    <Field className="max-w-64">
      <Label id="payment-method-label">Forma de pagamento</Label>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (!next && create.isPending) return;
          if (next) setOpen(true);
          else close();
        }}
      >
        <PopoverTrigger
          type="button"
          disabled={state.methodsLoading || state.methodsError || create.isPending}
          aria-labelledby="payment-method-label"
          className="flex h-control-sm w-full items-center justify-between gap-2 rounded-sm border border-input bg-field px-3 text-left text-control text-foreground outline-none focus-visible:border-ring focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-disabled"
        >
          <span className="min-w-0 truncate">
            {selected?.name ?? (state.methodsLoading ? "Carregando…" : "Selecione")}
          </span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-icon" />
        </PopoverTrigger>
        <PaymentMethodOptions state={state} model={model} />
      </Popover>
      {state.methodsError && (
        <FieldError match>
          Não foi possível carregar as formas de pagamento.{" "}
          <Button variant="link" size="inline" onClick={state.refresh}>
            Tentar novamente
          </Button>
        </FieldError>
      )}
    </Field>
  );
}

function PaymentMethodOptions({
  state,
  model,
}: {
  state: PaymentFormState;
  model: PaymentMethodModel;
}): ReactElement {
  const { adding, setAdding, selected, close } = model;
  return (
    <PopoverContent align="start" size="md" showArrow={false} aria-label="Formas de pagamento">
      <div className="grid gap-1">
        {state.methods.map((method) => (
          <button
            key={method.id}
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left text-control text-foreground outline-none hover:bg-accent focus-visible:bg-accent focus-visible:shadow-focus"
            aria-current={selected?.code === method.code ? "true" : undefined}
            onClick={() => {
              state.dispatch({
                type: "method",
                value: method.code,
                externalFinancing: method.allowsExternalInstallments,
              });
              close();
            }}
          >
            <span className="min-w-0 truncate">{method.name}</span>
            {selected?.code === method.code && <Check aria-hidden="true" className="size-4" />}
          </button>
        ))}
        <div className="my-1 border-t border-border" />
        {adding ? (
          <NewPaymentMethodForm model={model} />
        ) : (
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-control text-foreground outline-none hover:bg-accent focus-visible:bg-accent focus-visible:shadow-focus"
            onClick={() => setAdding(true)}
          >
            <Plus aria-hidden="true" className="size-4" /> Adicionar
          </button>
        )}
      </div>
    </PopoverContent>
  );
}

function NewPaymentMethodForm({ model }: { model: PaymentMethodModel }): ReactElement {
  const { submit, inputId, input, name, error, create, setName, setError } = model;
  return (
    <form noValidate onSubmit={submit} className="grid gap-2 pt-1">
      <Label htmlFor={inputId}>Nova forma de pagamento</Label>
      <Input
        id={inputId}
        ref={input}
        name="paymentMethodName"
        autoComplete="off"
        size="sm"
        maxLength={MAX_PAYMENT_METHOD_NAME_LENGTH}
        placeholder="Ex.: transferência"
        value={name}
        invalid={Boolean(error)}
        disabled={create.isPending}
        onChange={(event) => {
          setName(capitalizePaymentMethodName(event.target.value));
          setError("");
        }}
      />
      {error && <FieldError match>{error}</FieldError>}
      <Button type="submit" size="sm" loading={create.isPending}>
        Adicionar
      </Button>
    </form>
  );
}
