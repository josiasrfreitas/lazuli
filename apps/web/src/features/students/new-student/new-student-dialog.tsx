import { useReducer, type Dispatch, type ReactElement, type ReactNode } from "react";

import {
  Alert,
  AlertContent,
  AlertDescription,
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  EmptyState,
  Stepper,
} from "@lazuli/ui";

import { toDateOnlySaoPaulo } from "~/lib/format";

import { useCreateStudent, type CreateStudent } from "../logic";
import { DadosStep } from "./dados-step";
import {
  initialNewStudentState,
  isMinorOn,
  NEW_STUDENT_STEPS,
  newStudentReducer,
  type NewStudentAction,
  type NewStudentState,
} from "./reducer";
import { toCreateInput } from "./to-create-input";
import { useScrollToError } from "./use-scroll-to-error";

const STEPS = NEW_STUDENT_STEPS.map((label) => ({ label }));
const DADOS_STEP = 0;
const TURMA_STEP = 1;

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

type WizardProps = {
  state: NewStudentState;
  dispatch: Dispatch<NewStudentAction>;
  creation?: CreateStudent | undefined;
  onCancel?: (() => void) | undefined;
};

function WizardFooter({ state, dispatch, creation, onCancel }: WizardProps): ReactElement {
  const advance = (): void => {
    dispatch({ type: "nextRequested", today: toDateOnlySaoPaulo(new Date()) });
  };

  if (state.step === DADOS_STEP) {
    return (
      <DialogFooter className="mt-6">
        <Button onClick={onCancel} variant="ghost">
          Cancelar
        </Button>
        <Button onClick={advance}>Avançar</Button>
      </DialogFooter>
    );
  }

  const submitting = creation?.isPending === true;

  return (
    <DialogFooter className="mt-6">
      <Button
        disabled={submitting}
        onClick={() => {
          dispatch({ type: "backRequested" });
        }}
        variant="ghost"
      >
        Voltar
      </Button>
      {state.step === TURMA_STEP ? (
        <Button onClick={advance} variant="secondary">
          Pular
        </Button>
      ) : (
        <Button
          disabled={submitting}
          onClick={() => {
            creation?.create(toCreateInput(state.fields));
          }}
        >
          Concluir
        </Button>
      )}
    </DialogFooter>
  );
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
