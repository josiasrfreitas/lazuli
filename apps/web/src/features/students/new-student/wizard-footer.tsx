import type { Dispatch, ReactElement } from "react";

import { Button, DialogFooter } from "@lazuli/ui";

import { toDateOnlySaoPaulo } from "~/lib/format";

import type { CreateStudent } from "../logic";
import type { NewStudentAction, NewStudentState } from "./reducer";
import { toCreateInput } from "./to-create-input";

export const DADOS_STEP = 0;
export const TURMA_STEP = 1;

export type WizardProps = {
  state: NewStudentState;
  dispatch: Dispatch<NewStudentAction>;
  creation?: CreateStudent | undefined;
  onCancel?: (() => void) | undefined;
};

export function WizardFooter({ state, dispatch, creation, onCancel }: WizardProps): ReactElement {
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
