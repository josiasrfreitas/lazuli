import type { FormEvent } from "react";
import { validateDados } from "./reducer";
import type { ClassSources } from "./new-student-sources";
import type { EnrollmentIdentity, EnrollmentFlow } from "./new-student-state";
import type { EnrollmentDocuments } from "~/features/student-documents/use-enrollment-documents";

export type EnrollmentNavigation = {
  clearLead: () => void;
  close: () => void;
  validateStudent: (reportErrors?: boolean) => boolean;
  advance: (event: FormEvent) => void;
};

type NavigationContext = {
  identity: EnrollmentIdentity;
  flow: EnrollmentFlow;
  documents: Pick<EnrollmentDocuments, "captureBusy" | "selection">;
  classes: ClassSources;
  today: string;
  onOpenChange: (open: boolean) => void;
  saveBeforeClose: () => boolean;
};

function clearEnrollmentLead(identity: EnrollmentIdentity, flow: EnrollmentFlow): void {
  flow.setDirty(true);
  identity.setCandidateId(null);
  identity.setDraftLead(null);
  identity.prefilled.current = null;
  identity.setStageId(null);
  identity.setSelectedId("");
  identity.dispatch({ type: "reset" });
  flow.setError("");
}

function captureBlocksClose(
  documents: NavigationContext["documents"],
  flow: EnrollmentFlow,
): boolean {
  if (documents.captureBusy) return true;
  if (!documents.selection?.file) return false;
  flow.setError("Envie ou descarte o anexo selecionado antes de fechar.");
  return true;
}

function captureBlocksAdvance(
  documents: NavigationContext["documents"],
  flow: EnrollmentFlow,
): boolean {
  if (documents.captureBusy) return true;
  if (!documents.selection?.file) return false;
  flow.setError("Envie ou descarte o anexo selecionado antes de continuar.");
  return true;
}

export function createEnrollmentNavigation(context: NavigationContext): EnrollmentNavigation {
  const { identity, flow, documents, classes, today, onOpenChange } = context;
  const clearLead: EnrollmentNavigation["clearLead"] = () => clearEnrollmentLead(identity, flow);
  const close: EnrollmentNavigation["close"] = () => {
    if (captureBlocksClose(documents, flow)) return;
    if (
      identity.addressPending ||
      flow.busy.current ||
      flow.confirmation ||
      flow.discarding ||
      flow.capturingLead
    )
      return;
    if (flow.dirty) {
      if (!context.saveBeforeClose()) flow.setDiscarding(true);
    } else onOpenChange(false);
  };
  const validateStudent: EnrollmentNavigation["validateStudent"] = (reportErrors = true) => {
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
    if (!reportErrors) return false;
    identity.dispatch({ type: "serverRejected", errors, formError: null });
    requestAnimationFrame(() =>
      identity.popup.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
    );
    return false;
  };
  const advance: EnrollmentNavigation["advance"] = (event) => {
    event.preventDefault();
    if (captureBlocksAdvance(documents, flow)) return;
    if (identity.addressPending || !validateStudent() || classes.blockedLead) return;
    flow.setError("");
    if (flow.step === "student") flow.setStep("address");
    else if (flow.step === "address") flow.setStep("pedagogy");
    else {
      flow.setStep("contract");
      flow.setVisitedContract(true);
    }
  };
  return { clearLead, close, validateStudent, advance };
}
