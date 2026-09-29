import type { ReactElement } from "react";
import { Button, FormSection } from "@lazuli/ui";
import { ConditionsSection } from "../../contracts/contract-form-fields";
import { PaymentSection } from "../../contracts/contract-payment-section";
import type { StudentCompletion } from "./completion";
import { WizardPayerFields } from "./payer-fields";
import type { NewStudentFields } from "./reducer";

export const FINANCE_FORM_ID = "new-student-finance";

export type FinanceStepProps = {
  student: NewStudentFields;
  completion: {
    state: Pick<StudentCompletion["state"], "fields" | "errors" | "change" | "submissionError">;
    offer: Pick<StudentCompletion["offer"], "data" | "isPending" | "isError"> & {
      refetch: () => void;
    };
    preview: StudentCompletion["preview"];
    pending: boolean;
    finish: (withContract: boolean) => void;
  };
};

function OfferMessage({ offer }: { offer: FinanceStepProps["completion"]["offer"] }): ReactElement {
  return (
    <>
      {offer.isPending && (
        <p className="mb-3 text-caption text-muted-foreground" role="status">
          Carregando condições…
        </p>
      )}
      {offer.isError && (
        <p className="mb-3 text-caption" role="alert">
          Não foi possível carregar as condições.{" "}
          <Button type="button" variant="link" onClick={() => void offer.refetch()}>
            Tentar novamente
          </Button>
        </p>
      )}
      {offer.data === null && (
        <p className="mb-3 text-caption" role="alert">
          Configure os ajustes financeiros antes de criar contratos. Você pode criar só o aluno.
        </p>
      )}
    </>
  );
}

export function FinanceStep({ completion, student }: FinanceStepProps): ReactElement {
  const { state, offer, preview, pending } = completion;
  const props = {
    fields: state.fields,
    errors: state.errors,
    offer: offer.data,
    preview,
    change: state.change,
    maskedDates: true,
  };
  return (
    <form
      id={FINANCE_FORM_ID}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        completion.finish(true);
      }}
    >
      <OfferMessage offer={offer} />
      <fieldset className="grid gap-5" disabled={pending}>
        <div className="grid items-start gap-5 md:grid-cols-2">
          <WizardPayerFields {...props} student={student} />
          <FormSection title="Condições do contrato">
            <ConditionsSection {...props} />
          </FormSection>
        </div>
        <FormSection title="Plano de pagamento">
          <PaymentSection {...props} />
        </FormSection>
      </fieldset>
      {state.submissionError && (
        <p role="alert" className="mt-3 text-caption text-destructive">
          {state.submissionError}
        </p>
      )}
    </form>
  );
}
