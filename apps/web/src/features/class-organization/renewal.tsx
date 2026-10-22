"use client";
import type { JSX as ReactJSX } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Button, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { TextControl } from "~/features/classes/form-controls";
import { TaskDialog } from "~/features/shared/task-form";
import { ContractFormFields } from "~/features/contracts/contract-form-fields";
import { useRenewalModel, type RenewalModel } from "./renewal-model";

type Props = { contractId: string; onClose: () => void; onSaved: () => void };
type RenewalTerms = RouterOutputs["finance"]["renewalTerms"];

export function RenewalDialog(props: Props): ReactJSX.Element {
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
}: Props & { data: RenewalTerms }): ReactJSX.Element {
  const model = useRenewalModel({ data, onClose, onSaved });
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
      pending={model.pending}
      onClose={onClose}
      error={model.error}
    >
      <RenewalForm model={model} offer={data.offer} />
    </TaskDialog>
  );
}

function RenewalForm({
  model,
  offer,
}: {
  model: RenewalModel;
  offer: RenewalTerms["offer"];
}): ReactJSX.Element {
  return (
    <form id="renewal-form" noValidate className="grid gap-4 pt-3" onSubmit={model.submit}>
      <p className="text-caption text-muted-foreground">
        Mensalidade, pagador, parcelamento, descontos e encargos vêm do contrato anterior. Revise as
        datas financeiras; elas são independentes do calendário letivo.
      </p>
      <div className="w-40">
        <TextControl
          name="renewal-first-due"
          label="Primeiro vencimento"
          placeholder="dd/mm/aaaa"
          inputMode="numeric"
          value={model.firstDueDate}
          error={model.dueError}
          onChange={model.changeDueDate}
        />
      </div>
      <ContractFormFields
        maskedDates
        fields={model.state.fields}
        errors={model.state.errors}
        offer={offer}
        preview={model.preview}
        change={model.state.change}
      />
    </form>
  );
}
