"use client";
import type { Dispatch, JSX as ReactJSX, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import { addCalendarMonths } from "@lazuli/domain";
import { addContractMaterialInputSchema } from "@lazuli/validators";
import { Button, DialogBody, DialogFooter, Field, Input, Label } from "@lazuli/ui";
import { ArrowLeft } from "lucide-react";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
import { ContractMaterialSection } from "./contract-material-section";
import { emptyContractFields, type ContractFields } from "./contract-form-model";

const ISO_YEAR_LENGTH = 4;
const MONTHS_PER_YEAR = 12;
const ISO_MONTH_START_INDEX = 5;
const ISO_MONTH_LENGTH = 7;
type MaterialProps = {
  contractId: string;
  firstDueDate: string;
  onPendingChange: (pending: boolean) => void;
  onClose: () => void;
  onSaved: () => void;
};
type MaterialErrors = Partial<Record<keyof ContractFields, string>>;
type MaterialFieldsState = {
  month: string;
  setMonth: Dispatch<SetStateAction<string>>;
  fields: ContractFields;
  errors: MaterialErrors;
  setErrors: Dispatch<SetStateAction<MaterialErrors>>;
  dueDate: string;
  change: (key: keyof ContractFields, value: string) => void;
};
type MaterialSubmission = { error: string; submit: () => void; pending: boolean };

function dueDateInMonth(anchor: string, month: string): string {
  const offset =
    (Number(month.slice(0, ISO_YEAR_LENGTH)) - Number(anchor.slice(0, ISO_YEAR_LENGTH))) *
      MONTHS_PER_YEAR +
    Number(month.slice(ISO_MONTH_START_INDEX, ISO_MONTH_LENGTH)) -
    Number(anchor.slice(ISO_MONTH_START_INDEX, ISO_MONTH_LENGTH));
  return /^\d{4}-\d{2}$/u.test(month) && offset >= 0 ? addCalendarMonths(anchor, offset) : "";
}

function invalidMaterialFields(fields: ContractFields): MaterialErrors {
  const stageIds = fields.materialStageIds.split(",");
  const invalidStages = stageIds.some((id) => !id) || new Set(stageIds).size !== stageIds.length;
  return {
    ...(invalidStages
      ? { materialStageIds: "Selecione um estágio diferente para cada livro." }
      : {}),
    ...(fields.materialCategory ? {} : { materialCategory: "Selecione a faixa." }),
    ...(fields.materialTotal ? {} : { materialTotal: "Aguarde o preço do livro." }),
  };
}

function materialValidationMessage(dueDate: string): string {
  return dueDate
    ? "Confira os campos indicados."
    : "Escolha um mês a partir do primeiro vencimento do contrato.";
}

function useMaterialFields(firstDueDate: string): MaterialFieldsState {
  const today = toDateOnlySaoPaulo(new Date());
  const [month, setMonth] = useState(
    (today.localeCompare(firstDueDate) > 0 ? today : firstDueDate).slice(0, ISO_MONTH_LENGTH),
  );
  const [fields, setFields] = useState<ContractFields>({
    ...emptyContractFields,
    materialPayment: "INSTALLMENTS",
  });
  const [errors, setErrors] = useState<MaterialErrors>({});
  const dueDate = dueDateInMonth(firstDueDate, month);
  function change(key: keyof ContractFields, value: string): void {
    setFields((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }
  return { month, setMonth, fields, errors, setErrors, dueDate, change };
}

function useMaterialSubmission(
  { contractId, onPendingChange, onClose, onSaved }: MaterialProps,
  state: MaterialFieldsState,
): MaterialSubmission {
  const [error, setError] = useState("");
  const commandId = useRef(crypto.randomUUID());
  const submitting = useRef(false);
  const mutation = trpc.finance.addContractMaterial.useMutation();
  const utils = trpc.useUtils();
  function submit(): void {
    if (submitting.current) return;
    const { fields, dueDate } = state;
    const parsed = addContractMaterialInputSchema.safeParse({
      commandId: commandId.current,
      contractId,
      firstDueDate: dueDate,
      material: {
        stageIds: fields.materialStageIds.split(","),
        quoteVersion: fields.materialQuoteVersion,
        category: fields.materialCategory,
        payment: fields.materialPayment,
        expectedTotalCents: fields.materialTotal === "" ? Number.NaN : Number(fields.materialTotal),
      },
    });
    if (!parsed.success) {
      state.setErrors(invalidMaterialFields(fields));
      setError(materialValidationMessage(dueDate));
      return;
    }
    setError("");
    submitting.current = true;
    onPendingChange(true);
    mutation.mutate(parsed.data, {
      onSuccess: () => {
        onPendingChange(false);
        onSaved();
        onClose();
      },
      onError: (cause) => {
        setError(cause.message);
        void utils.finance.readMaterialPrice.invalidate();
      },
      onSettled: () => {
        submitting.current = false;
        onPendingChange(false);
      },
    });
  }
  return { error, submit, pending: mutation.isPending };
}

function MaterialReceiptFields({
  firstDueDate,
  state,
}: {
  firstDueDate: string;
  state: MaterialFieldsState;
}): ReactJSX.Element {
  return (
    <section
      className="grid min-w-0 gap-3 border-t border-border pt-4"
      aria-label="Recebimento do material"
    >
      <h3 className="text-base font-semibold text-heading">Recebimento</h3>
      <p className="text-sm text-muted-foreground">
        Uma cobrança para a escola. As parcelas no cartão são condições acordadas com o aluno.
      </p>
      <Field name="materialMonth" className="max-w-64">
        <Label>Mês previsto para o recebimento</Label>
        <Input
          name="materialMonth"
          type="month"
          value={state.month}
          min={firstDueDate.slice(0, ISO_MONTH_LENGTH)}
          onChange={(event) => state.setMonth(event.target.value)}
        />
      </Field>
      {state.dueDate && (
        <p className="text-sm text-muted-foreground">
          Recebimento previsto em {formatDateOnlyBR(state.dueDate)}, seguindo o dia do contrato.
        </p>
      )}
    </section>
  );
}

function MaterialInputs({
  firstDueDate,
  state,
  pending,
}: {
  firstDueDate: string;
  state: MaterialFieldsState;
  pending: boolean;
}): ReactJSX.Element {
  return (
    <fieldset disabled={pending} className="grid items-start gap-8 md:grid-cols-2">
      <div className="min-w-0">
        <ContractMaterialSection
          required
          fields={{
            ...state.fields,
            firstDueDate: state.dueDate ? formatDateOnlyBR(state.dueDate) : "",
          }}
          errors={state.errors}
          change={state.change}
        />
      </div>
      <MaterialReceiptFields firstDueDate={firstDueDate} state={state} />
    </fieldset>
  );
}

function MaterialActions({
  pending,
  onClose,
}: {
  pending: boolean;
  onClose: () => void;
}): ReactJSX.Element {
  return (
    <DialogFooter>
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onClose}>
        <ArrowLeft aria-hidden="true" /> Voltar aos itens
      </Button>
      <Button type="submit" form="contract-material-form" size="sm" disabled={pending}>
        {pending ? "Salvando…" : "Adicionar material"}
      </Button>
    </DialogFooter>
  );
}

export function AddContractMaterial(props: MaterialProps): ReactJSX.Element {
  const state = useMaterialFields(props.firstDueDate);
  const submission = useMaterialSubmission(props, state);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    body.current?.querySelector<HTMLElement>("[role=combobox]")?.focus();
  }, []);
  return (
    <>
      <DialogBody ref={body}>
        <form
          id="contract-material-form"
          className="grid gap-6 py-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submission.submit();
          }}
        >
          <MaterialInputs
            firstDueDate={props.firstDueDate}
            state={state}
            pending={submission.pending}
          />
          {submission.error && (
            <p role="alert" className="text-sm text-destructive">
              {submission.error}
            </p>
          )}
        </form>
      </DialogBody>
      <MaterialActions pending={submission.pending} onClose={props.onClose} />
    </>
  );
}
