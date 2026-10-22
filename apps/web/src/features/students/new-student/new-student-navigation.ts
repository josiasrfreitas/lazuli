import type { FormEvent } from "react";
import { validateDados } from "./reducer";
import type { ClassSources } from "./new-student-sources";
import type { EnrollmentIdentity, EnrollmentFlow } from "./new-student-state";

export type EnrollmentNavigation = {
  clearLead: () => void;
  close: () => void;
  validateStudent: () => boolean;
  advance: (event: FormEvent) => void;
};

type NavigationContext = {
  identity: EnrollmentIdentity;
  flow: EnrollmentFlow;
  classes: ClassSources;
  today: string;
  onOpenChange: (open: boolean) => void;
};

export function createEnrollmentNavigation(context: NavigationContext): EnrollmentNavigation {
  const { identity, flow, classes, today, onOpenChange } = context;
  const clearLead: EnrollmentNavigation["clearLead"] = () => {
    flow.setDirty(true);
    identity.setCandidateId(null);
    identity.setDraftLead(null);
    identity.prefilled.current = null;
    identity.setStageId(null);
    identity.setSelectedId("");
    identity.dispatch({ type: "reset" });
    flow.setError("");
  };
  const close: EnrollmentNavigation["close"] = () => {
    if (flow.busy.current || flow.confirmation || flow.discarding || flow.capturingLead) return;
    if (flow.dirty) flow.setDiscarding(true);
    else onOpenChange(false);
  };
  const validateStudent: EnrollmentNavigation["validateStudent"] = () => {
    const errors = validateDados(identity.state.fields, today);
    if (classes.minor) {
      if (!identity.state.fields.guardianName.trim())
        errors.guardianName = "Informe o nome do responsável.";
      if (
        !identity.state.fields.guardianPhone.trim() &&
        !identity.state.fields.guardianEmail.trim()
      )
        errors.guardianPhone = "Informe telefone ou e-mail do responsável.";
    }
    if (Object.keys(errors).length === 0) return true;
    identity.dispatch({ type: "serverRejected", errors, formError: null });
    requestAnimationFrame(() =>
      identity.popup.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
    );
    return false;
  };
  const advance: EnrollmentNavigation["advance"] = (event) => {
    event.preventDefault();
    if (!validateStudent() || classes.blockedLead) return;
    flow.setError("");
    if (flow.step === "student") flow.setStep("pedagogy");
    else {
      flow.setStep("contract");
      flow.setVisitedContract(true);
    }
  };
  return { clearLead, close, validateStudent, advance };
}
