import type { Dispatch, ReactElement } from "react";

import { Button, DialogFooter } from "@lazuli/ui";

import { toDateOnlySaoPaulo } from "~/lib/format";

import type { CreateStudent } from "../logic";
import { DADOS_FORM_ID } from "./dados-step";
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
    // Submitting the Dados form (Enter or this button) runs the same validation.
    return (
      <DialogFooter className="mt-6">
        <Button onClick={onCancel} type="button" variant="ghost">
          Cancelar
        </Button>
        <Button form={DADOS_FORM_ID} type="submit">
          Avançar
        </Button>
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
