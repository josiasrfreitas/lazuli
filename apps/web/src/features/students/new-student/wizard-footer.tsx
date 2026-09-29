import type { Dispatch, ReactElement } from "react";
import { Button, DialogFooter } from "@lazuli/ui";
import type { StudentCompletion } from "./completion";
import { DADOS_FORM_ID } from "./dados-step";
import { FINANCE_FORM_ID } from "./finance-step";
import type { NewStudentAction, NewStudentState } from "./reducer";

export const DADOS_STEP = 0;
export const FINANCE_STEP = 2;

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

export function WizardFooter({
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
    <DialogFooter className="mt-5">
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
