import { useReducer, type ReactElement, type ReactNode } from "react";

import {
  Alert,
  AlertContent,
  AlertDescription,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  EmptyState,
  Stepper,
} from "@lazuli/ui";

import { toDateOnlySaoPaulo } from "~/lib/format";

import { useCreateStudent } from "../logic";
import { DadosStep } from "./dados-step";
import { initialNewStudentState, isMinorOn, NEW_STUDENT_STEPS, newStudentReducer } from "./reducer";
import { useScrollToError } from "./use-scroll-to-error";
import { DADOS_STEP, TURMA_STEP, WizardFooter, type WizardProps } from "./wizard-footer";

const STEPS = NEW_STUDENT_STEPS.map((label) => ({ label }));

function StepBody({ state, dispatch }: WizardProps): ReactNode {
  if (state.step === DADOS_STEP) {
    const today = toDateOnlySaoPaulo(new Date());

    return (
      <DadosStep
        errors={state.errors}
        fields={state.fields}
        minor={isMinorOn({ birthDate: state.fields.birthDate, today })}
        onFieldChange={(field, value) => {
          dispatch({ type: "fieldChanged", field, value });
        }}
      />
    );
  }

  const placeholder =
    state.step === TURMA_STEP
      ? { title: "Matrícula em breve", body: "Cadastre o aluno agora e matricule na turma depois." }
      : { title: "Financeiro em breve", body: "O plano de pagamento entra depois da matrícula." };

  return <EmptyState description={placeholder.body} title={placeholder.title} />;
}

/**
 * The "Novo aluno" wizard. Steps Turma and Financeiro ship as placeholders
 * (creation never blocks on them — brief principle 2); success closes the
 * dialog and hands the created id back so the page opens its preview panel.
 */
export function NewStudentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}): ReactElement {
  const [state, dispatch] = useReducer(newStudentReducer, initialNewStudentState);
  const creation = useCreateStudent({
    onCreated: (id) => {
      dispatch({ type: "reset" });
      onCreated(id);
    },
    onRejected: (rejection) => {
      dispatch({ type: "serverRejected", ...rejection });
    },
  });

  const requestClose = (next: boolean): void => {
    // An in-flight create pins the wizard open: a late success would reopen
    // the preview and a late error would hit a dismissed dialog.
    if (!next && creation.isPending) {
      return;
    }

    if (!next) {
      dispatch({ type: "reset" });
    }
    onOpenChange(next);
  };

  return (
    <Dialog onOpenChange={requestClose} open={open}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="md:max-w-xl">
          <WizardContent
            creation={creation}
            dispatch={dispatch}
            onCancel={() => {
              requestClose(false);
            }}
            state={state}
          />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function WizardContent({ state, dispatch, creation, onCancel }: WizardProps): ReactElement {
  const bodyRef = useScrollToError(state.errorsRevision);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Novo aluno</DialogTitle>
        <DialogDescription>
          Só o nome é obrigatório. Turma e financeiro podem ficar para depois.
        </DialogDescription>
      </DialogHeader>
      <Stepper activeIndex={state.step} className="mt-4" label="Etapas do cadastro" steps={STEPS} />
      {state.formError === null ? null : (
        <Alert className="mt-4" variant="destructive">
          <AlertContent>
            <AlertDescription>{state.formError}</AlertDescription>
          </AlertContent>
        </Alert>
      )}
      <DialogBody className="mt-5" ref={bodyRef}>
        <StepBody dispatch={dispatch} state={state} />
      </DialogBody>
      <WizardFooter creation={creation} dispatch={dispatch} onCancel={onCancel} state={state} />
    </>
  );
}
