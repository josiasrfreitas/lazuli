import type { FormEvent, JSX as ReactJSX } from "react";
import { ArrowLeft, ArrowRight, RefreshCw, TriangleAlert, X } from "lucide-react";
import { ToastAlert, Button } from "@lazuli/ui";
import { TaskDialog } from "~/features/shared/task-form";
import { formatDateOnlyBR } from "~/lib/format";
import {
  type TerminationAmounts,
  type TerminationPreview,
  type TerminationState,
} from "./contract-termination-state";
import { TerminationDetails } from "./contract-termination-fields";
import { ContractRenegotiationMode } from "./contract-renegotiation-mode";

export type TerminationViewProps = {
  preview: TerminationPreview;
  state: TerminationState;
  amounts: TerminationAmounts;
  onClose: () => void;
  onRefresh: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
  pending: boolean;
  mutationError: string | undefined;
  onReduce?: (() => void) | undefined;
};

export function TerminationView(props: TerminationViewProps): ReactJSX.Element {
  const { preview, state, amounts, onClose, onReset, pending } = props;
  const handleBack = (): void => {
    state.setReview(false);
    state.setAcknowledged(false);
    state.setConfirmationName("");
    onReset();
  };
  return (
    <TaskDialog
      title="Renegociar contrato"
      description={preview.studentName}
      onClose={onClose}
      pending={pending}
      formId="contract-termination"
      firstField="termination-fee"
      size="wide"
      compactHeader
      actionSize="sm"
      layout="termination"
      bodyLayout="termination"
      submitLabel={state.review ? "Rescindir e encerrar" : "Revisar rescisão"}
      submitIcon={
        state.review ? <TriangleAlert aria-hidden="true" /> : <ArrowRight aria-hidden="true" />
      }
      cancelIcon={<X aria-hidden="true" />}
      backIcon={<ArrowLeft aria-hidden="true" />}
      submitVariant={state.review ? "destructive" : "primary"}
      submitDisabled={state.review && (!state.acknowledged || !amounts.nameConfirmed)}
      onBack={state.review ? handleBack : undefined}
    >
      {props.onReduce && (
        <ContractRenegotiationMode
          value="terminate"
          onChange={props.onReduce}
          disabled={pending || state.review}
        />
      )}
      <TerminationFormBody {...props} />
    </TaskDialog>
  );
}

function TerminationFormBody(props: TerminationViewProps): ReactJSX.Element {
  const { preview, state, onSubmit, onRefresh, mutationError } = props;
  return (
    <form id="contract-termination" className="grid gap-3" onSubmit={onSubmit}>
      <ToastAlert variant="destructive">
        <strong>Atenção: esta ação é irreversível.</strong>
        <p>
          Ao confirmar, o contrato será rescindido e as matrículas selecionadas serão encerradas em{" "}
          {formatDateOnlyBR(preview.today)}.
        </p>
        <p>Os pagamentos já recebidos continuarão no histórico. Não haverá reembolso automático.</p>
      </ToastAlert>
      <TerminationDetails {...props} />
      {(state.error ?? mutationError) && (
        <p role="alert" className="flex items-start gap-1.5 text-caption text-destructive">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {state.error ?? mutationError}
        </p>
      )}
      {mutationError && (
        <Button type="button" variant="secondary" onClick={onRefresh}>
          <RefreshCw aria-hidden="true" /> Atualizar prévia do acerto
        </Button>
      )}
    </form>
  );
}
