"use client";
import { Alert, Button, FormSection } from "@lazuli/ui";
import { ConditionsSection } from "~/features/contracts/contract-form-fields";
import { ContractPayerFields } from "~/features/contracts/contract-payer-fields";
import { ContractMaterialSection } from "~/features/contracts/contract-material-section";
import { PaymentSection } from "~/features/contracts/contract-payment-section";
import {
  validatePrice,
  type ContractFormState,
  type ContractOperation,
} from "~/features/contracts/new-contract-state";
import { contractFieldsWithStudent, studentContractPreview } from "./finance-model";
import type { NewStudentFields } from "./reducer";

export function IntakeContract({
  state,
  student,
  offer,
  pending,
}: {
  state: ContractFormState;
  student: NewStudentFields;
  offer: ContractOperation["offer"];
  pending: boolean;
}) {
  const props = {
    fields: contractFieldsWithStudent(state.fields, student),
    errors: state.errors,
    change: state.change,
    offer: offer.data,
    preview: studentContractPreview({ fields: state.fields, student, offer: offer.data }),
    onMonthlyAmountBlur: () => validatePrice(state, offer.data),
  };
  return (
    <div ref={state.popup} className="grid gap-4">
      <fieldset disabled={pending} className="grid gap-6 lg:grid-cols-2">
        <div className="grid content-start gap-4">
          <FormSection title="Responsável financeiro">
            <ContractPayerFields {...props} />
          </FormSection>
          <ContractMaterialSection {...props} />
        </div>
        <div className="grid content-start gap-4 lg:border-l lg:border-border lg:pl-6">
          <FormSection title="Condições do contrato">
            <ConditionsSection {...props} />
          </FormSection>
          <PaymentSection {...props} />
        </div>
      </fieldset>
      {offer.isPending && (
        <p role="status" className="text-caption">
          Carregando condições…
        </p>
      )}
      {offer.isError && (
        <Alert variant="destructive">
          Não foi possível carregar as condições.{" "}
          <Button variant="ghost" onClick={() => offer.refetch()}>
            Tentar novamente
          </Button>
        </Alert>
      )}
      {!offer.isPending && !offer.isError && !offer.data && (
        <Alert variant="warning">
          Configure as condições financeiras para criar o contrato ou salve o aluno com contrato
          pendente.
        </Alert>
      )}
    </div>
  );
}
