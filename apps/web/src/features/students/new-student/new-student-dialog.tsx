import { useEffect, useReducer, useRef, type Dispatch, type ReactElement } from "react";
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
  Stepper,
} from "@lazuli/ui";
import { useStudentCompletion, type StudentCompletion } from "./completion";
import {
  initialNewStudentState,
  NEW_STUDENT_STEPS,
  newStudentReducer,
  type NewStudentAction,
  type NewStudentState,
} from "./reducer";
import { useScrollToError } from "./use-scroll-to-error";
import { WizardBody } from "./wizard-body";
import { FINANCE_STEP, WizardFooter } from "./wizard-footer";

const STEPS = NEW_STUDENT_STEPS.map((label) => ({ label }));

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
          className={state.step === FINANCE_STEP ? "md:max-w-3xl" : "md:max-w-xl"}
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
        className="mt-4 gap-2 sm:gap-3 [&_[data-slot=stepper-step]>[aria-hidden]]:hidden sm:[&_[data-slot=stepper-step]>[aria-hidden]]:block"
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
      <DialogBody className="mt-5" ref={bodyRef}>
        <WizardBody state={state} dispatch={dispatch} completion={completion} />
      </DialogBody>
      <WizardFooter state={state} dispatch={dispatch} completion={completion} onCancel={onCancel} />
    </>
  );
}
