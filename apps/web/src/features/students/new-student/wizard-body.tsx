import type { Dispatch, ReactElement } from "react";
import { EmptyState } from "@lazuli/ui";
import { toDateOnlySaoPaulo } from "~/lib/format";
import type { StudentCompletion } from "./completion";
import { DadosStep } from "./dados-step";
import { FinanceStep } from "./finance-step";
import {
  isGuardianSectionOpen,
  isMinorFromFields,
  type NewStudentAction,
  type NewStudentState,
} from "./reducer";
import { DADOS_STEP, FINANCE_STEP } from "./wizard-footer";

export function WizardBody({
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
