import { useEffect, useReducer, useRef, type Dispatch, type ReactElement } from "react";
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
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogFooter,
  EmptyState,
  Stepper,
} from "@lazuli/ui";
import { toDateOnlySaoPaulo } from "~/lib/format";
import { useStudentCompletion, type StudentCompletion } from "./completion";
import { DadosStep, DADOS_FORM_ID } from "./dados-step";
import { FinanceStep, FINANCE_FORM_ID } from "./finance-step";
import {
  initialNewStudentState,
  NEW_STUDENT_STEPS,
  isGuardianSectionOpen,
  isMinorFromFields,
  newStudentReducer,
  type NewStudentAction,
  type NewStudentState,
} from "./reducer";
import { useScrollToError } from "./use-scroll-to-error";

const STEPS = NEW_STUDENT_STEPS.map((label) => ({ label }));
const DADOS_STEP = 0;
const FINANCE_STEP = 2;

export type NewStudentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
};

export function NewStudentDialog({
  open,
  onOpenChange,
  onCreated,
}: NewStudentDialogProps): ReactElement {
  const [state, dispatch] = useReducer(newStudentReducer, initialNewStudentState);
  const popupRef = useRef<HTMLDivElement>(null);
  const completion = useStudentCompletion({
    open,
    financeActive: state.step === FINANCE_STEP,
    student: state.fields,
    onCreated: (id) => {
      dispatch({ type: "reset" });
      onCreated(id);
    },
    onRejected: (rejection) => dispatch({ type: "serverRejected", ...rejection }),
  });
  const requestClose = (next: boolean): void => {
    if (!next && completion.isSubmitting()) return;
    if (!next) {
      completion.reset();
      dispatch({ type: "reset" });
    }
    onOpenChange(next);
  };
  return (
    <Dialog onOpenChange={requestClose} open={open}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className={state.step === FINANCE_STEP ? "md:max-w-2xl" : "md:max-w-xl"}
          initialFocus={() =>
            popupRef.current?.querySelector<HTMLInputElement>('input[name="fullName"]') ?? true
          }
          ref={popupRef}
        >
          <WizardContent
            state={state}
            dispatch={dispatch}
            completion={completion}
            onCancel={() => requestClose(false)}
          />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function WizardContent({
  state,
  dispatch,
  completion,
  onCancel,
}: {
  state: NewStudentState;
  dispatch: Dispatch<NewStudentAction>;
  completion: StudentCompletion;
  onCancel: () => void;
}): ReactElement {
  const bodyRef = useScrollToError(state.errorsRevision + completion.errorsRevision);
  useEffect(() => {
    const invalid = bodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    const field = invalid ?? bodyRef.current?.querySelector<HTMLInputElement>("input");
    const target = field?.querySelector<HTMLElement>("input, button") ?? field;
    target?.focus({ preventScroll: true });
  }, [state.step, bodyRef]);
  return (
    <>
      <DialogHeader>
        <DialogTitle>Novo aluno</DialogTitle>
        <DialogDescription>
          {state.step === FINANCE_STEP
            ? "Crie um contrato agora ou cadastre só o aluno."
            : "Só o nome é obrigatório. A matrícula em turma pode ficar para depois."}
        </DialogDescription>
      </DialogHeader>
      <Stepper
        activeIndex={state.step}
        className="mt-3 gap-2 sm:gap-3 [&_[data-slot=stepper-step]>[aria-hidden]]:hidden sm:[&_[data-slot=stepper-step]>[aria-hidden]]:block"
        label="Etapas do cadastro"
        steps={STEPS}
      />
      {state.formError !== null && (
        <Alert className="mt-4" variant="destructive">
          <AlertContent>
            <AlertDescription>{state.formError}</AlertDescription>
          </AlertContent>
        </Alert>
      )}
      <DialogBody className="mt-4" ref={bodyRef}>
        <WizardBody state={state} dispatch={dispatch} completion={completion} />
      </DialogBody>
      <WizardFooter state={state} dispatch={dispatch} completion={completion} onCancel={onCancel} />
    </>
  );
}

function WizardBody({
  state,
  dispatch,
  completion,
}: {
  state: NewStudentState;
  dispatch: Dispatch<NewStudentAction>;
  completion: StudentCompletion;
}): ReactElement {
  const today = toDateOnlySaoPaulo(new Date());
  const next = (): void => dispatch({ type: "nextRequested", today });
  if (state.step === DADOS_STEP)
    return (
      <DadosStep
        errors={state.errors}
        fields={state.fields}
        guardianOpen={isGuardianSectionOpen(state, today)}
        minor={isMinorFromFields(state.fields, today)}
        onFieldChange={(field, value) => dispatch({ type: "fieldChanged", field, value })}
        onGuardianToggle={(open) => dispatch({ type: "guardianToggled", open })}
        onSubmit={next}
      />
    );
  if (state.step === FINANCE_STEP)
    return <FinanceStep completion={completion} student={state.fields} />;
  return (
    <form
      id="new-student-pedagogico"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        next();
      }}
    >
      <EmptyState
        description="Cadastre o aluno agora e matricule na turma depois."
        title="Matrícula em breve"
      />
    </form>
  );
}

function FinishActions({ completion }: { completion: StudentCompletion }): ReactElement {
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        disabled={completion.pending}
        onClick={() => completion.finish(false)}
      >
        Pular e criar aluno
      </Button>
      <Button
        form={FINANCE_FORM_ID}
        type="submit"
        disabled={completion.pending || !completion.offer.data}
      >
        {completion.pending ? "Criando…" : "Concluir com contrato"}
      </Button>
    </>
  );
}

function WizardFooter({
  state,
  dispatch,
  completion,
  onCancel,
}: {
  state: NewStudentState;
  dispatch: Dispatch<NewStudentAction>;
  completion: StudentCompletion;
  onCancel: () => void;
}): ReactElement {
  const { pending } = completion;
  return (
    <DialogFooter className="mt-4">
      {state.step === DADOS_STEP ? (
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          className="sm:mr-auto"
          disabled={pending}
          onClick={() => dispatch({ type: "backRequested" })}
        >
          Voltar
        </Button>
      )}
      {state.step === FINANCE_STEP ? (
        <FinishActions completion={completion} />
      ) : (
        <Button
          form={state.step === DADOS_STEP ? DADOS_FORM_ID : "new-student-pedagogico"}
          type="submit"
        >
          Avançar
        </Button>
      )}
    </DialogFooter>
  );
}
