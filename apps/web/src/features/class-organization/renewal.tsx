"use client";
import { useState } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { addCalendarMonths, previewMonthlyContract } from "@lazuli/domain";
import { Button, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
import { TextControl } from "~/features/classes/form-controls";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { TaskDialog } from "~/features/shared/task-form";
import { ContractFormFields } from "~/features/contracts/contract-form-fields";
import {
  emptyContractFields,
  contractInputFromFields,
} from "~/features/contracts/contract-form-model";
import { useContractFormState, fieldErrors } from "~/features/contracts/new-contract-state";

type Props = { contractId: string; onClose: () => void; onSaved: () => void };
export function RenewalDialog(props: Props) {
  const query = trpc.finance.renewalTerms.useQuery({ contractId: props.contractId });
  return query.data ? (
    <RenewalFields {...props} data={query.data} />
  ) : (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title="Renovar contrato"
      description={
        query.error
          ? "Os termos anteriores não puderam ser carregados."
          : "Recuperando os termos anteriores…"
      }
      formId="renewal-loading"
      firstField=""
      submitLabel="Renovar contrato"
      submitDisabled
      pending={false}
      onClose={props.onClose}
      error={query.error?.message}
    >
      {query.error ? (
        <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      ) : (
        <div className="grid gap-3 py-4">
          <InlineSkeleton className="h-8 w-full" />
          <InlineSkeleton className="h-24 w-full" />
        </div>
      )}
    </TaskDialog>
  );
}
function RenewalFields({
  data,
  onClose,
  onSaved,
}: Props & { data: RouterOutputs["finance"]["renewalTerms"] }) {
  const [initial] = useState(() => {
    const next = new Date(`${data.endsOn}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const start = next.toISOString().slice(0, 10);
    return {
      ...emptyContractFields,
      studentId: data.student.id,
      studentName: data.student.fullName,
      payerId: data.payer.id,
      payerLabel: data.payer.name,
      monthlyAmount: (data.monthlyAmountCents / 100).toFixed(2),
      agreedOn: formatDateOnlyBR(toDateOnlySaoPaulo(new Date())),
      firstDueDate: formatDateOnlyBR(start),
      endsOn: formatDateOnlyBR(addCalendarMonths(start, data.durationMonths)),
      paymentPlan: data.installmentCount === data.durationMonths ? "common" : "special",
      installmentCount: String(data.installmentCount),
    };
  });
  const state = useContractFormState(true, initial);
  const [firstDueDate, setFirstDueDate] = useState(() => {
    const start = new Date(`${parseDateBR(initial.firstDueDate)}T12:00:00Z`);
    const date = new Date(
      Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth(),
        Math.min(
          data.dueDay,
          new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate(),
        ),
        12,
      ),
    );
    if (date < start) {
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() + 1);
      date.setUTCDate(
        Math.min(
          data.dueDay,
          new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate(),
        ),
      );
    }
    return formatDateOnlyBR(date.toISOString().slice(0, 10));
  });
  const [dueError, setDueError] = useState("");
  const parsed = contractInputFromFields(state.fields, state.commandId.current);
  let preview: ReturnType<typeof previewMonthlyContract> | null = null;
  try {
    if (parsed.success && parseDateBR(firstDueDate))
      preview = previewMonthlyContract({
        ...parsed.data,
        firstDueDate: parseDateBR(firstDueDate)!,
        ...data.offer,
      });
  } catch {
    /* Invalid drafts remain editable until submission. */
  }

  const utils = trpc.useUtils();
  const mutation = trpc.finance.createMonthlyContract.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.finance.invalidate(), utils.semesterOrganization.invalidate()]);
      onSaved();
      onClose();
    },
  });
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      size="medium"
      title="Renovar contrato"
      description={`${data.student.fullName} · termos anteriores preenchidos`}
      formId="renewal-form"
      firstField="agreedOn"
      submitLabel="Confirmar renovação"
      pending={mutation.isPending}
      onClose={onClose}
      error={mutation.error?.message}
    >
      <form
        id="renewal-form"
        noValidate
        className="grid gap-4 pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (mutation.isPending) return;
          const values = contractInputFromFields(state.fields, state.commandId.current);
          if (!parseDateBR(firstDueDate)) {
            setDueError("Informe um primeiro vencimento válido.");
            return;
          }
          if (!values.success || !preview) {
            state.setErrors(fieldErrors(values, Boolean(preview)));
            return;
          }
          mutation.mutate({
            ...values.data,
            firstDueDate: parseDateBR(firstDueDate)!,
            renewedFromId: data.id,
          });
        }}
      >
        <p className="text-caption text-muted-foreground">
          Mensalidade, pagador, parcelamento, descontos e encargos vêm do contrato anterior. Revise
          as datas financeiras; elas são independentes do calendário letivo.
        </p>
        <div className="w-40">
          <TextControl
            name="renewal-first-due"
            label="Primeiro vencimento"
            placeholder="dd/mm/aaaa"
            inputMode="numeric"
            value={firstDueDate}
            error={dueError}
            onChange={(value) => {
              setFirstDueDate(maskDateBR(value));
              setDueError("");
            }}
          />
        </div>
        <ContractFormFields
          maskedDates
          fields={state.fields}
          errors={state.errors}
          offer={data.offer}
          preview={preview}
          change={state.change}
        />
      </form>
    </TaskDialog>
  );
}
