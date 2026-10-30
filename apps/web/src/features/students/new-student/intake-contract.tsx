"use client";
import type { JSX as ReactJSX } from "react";
import { ContractSetup } from "~/features/contracts/contract-setup";
import {
  type ContractFormState,
  type ContractOperation,
} from "~/features/contracts/new-contract-state";
import { contractInputFromFields } from "~/features/contracts/contract-form-model";
import { contractFieldsWithStudent, studentContractInput } from "./finance-model";
import type { NewStudentFields } from "./reducer";

type IntakeContractProps = {
  state: ContractFormState;
  student: NewStudentFields;
  existingStudentId?: string | undefined;
  offer: ContractOperation["offer"];
  pending: boolean;
  error: string;
  suggestedStageId: string | null;
  onComplete: () => void;
  onBack: () => void;
  onSaveWithout: () => void;
};

export function IntakeContract({
  state,
  student,
  existingStudentId,
  offer,
  pending,
  error,
  suggestedStageId,
  onComplete,
  onBack,
  onSaveWithout,
}: IntakeContractProps): ReactJSX.Element {
  return (
    <ContractSetup
      state={state}
      fields={contractFieldsWithStudent(state.fields, student)}
      parseInput={() =>
        existingStudentId
          ? contractInputFromFields(
              { ...state.fields, studentMode: "existing", studentId: existingStudentId },
              state.commandId.current,
            )
          : studentContractInput({
              fields: state.fields,
              student,
              commandId: state.commandId.current,
            })
      }
      offer={offer}
      pending={pending}
      studentKnown
      deferStudentValidation
      suggestedStageId={suggestedStageId}
      error={error}
      completeLabel="Concluir cadastro"
      onComplete={onComplete}
      onBack={onBack}
      onSaveWithout={onSaveWithout}
    />
  );
}
