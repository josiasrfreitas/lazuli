"use client";
import {
  useEnrollmentDocuments,
  type EnrollmentDocuments,
} from "~/features/student-documents/use-enrollment-documents";
import { useEffect, type JSX as ReactJSX } from "react";
import { showMobileUploadHint } from "~/features/student-documents/mobile-upload-hint";
import { toDateOnlySaoPaulo } from "~/lib/format";
import { EnrollmentDialogView } from "./new-student-view";
import {
  useEnrollmentIdentity,
  useEnrollmentFlow,
  useEnrollmentContract,
  type EnrollmentIdentity,
  type EnrollmentFlow,
  type EnrollmentContract,
} from "./new-student-state";
import {
  useEnrollmentSources,
  type ExistingSources,
  type LeadSources,
  type ClassSources,
} from "./new-student-sources";
import { createEnrollmentNavigation, type EnrollmentNavigation } from "./new-student-navigation";
import { useEnrollmentPersistence, type EnrollmentPersistence } from "./new-student-persistence";
import { createRequestSave } from "./new-student-request-save";
import { intakeStepCompletion } from "./new-student-completion";

export type IntakeStep = "student" | "address" | "pedagogy" | "contract";
const MOBILE_HINT_DELAY_MS = 2500;

export type NewStudentDialogProps = {
  open: boolean;
  initialStep?: IntakeStep;
  initialCandidateId?: string;
  existingStudentId?: string | undefined;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
};

export type EnrollmentModel = {
  documents: EnrollmentDocuments;
  existingStudentId: string | undefined;
  onOpenChange: (open: boolean) => void;
  today: string;
  requestSave: (withContract: boolean) => void;
  stepCompletion: { student: boolean; address: boolean };
} & EnrollmentIdentity &
  EnrollmentFlow &
  EnrollmentContract &
  ExistingSources &
  LeadSources &
  ClassSources &
  EnrollmentNavigation &
  EnrollmentPersistence;

export function NewStudentDialog(props: NewStudentDialogProps): ReactJSX.Element | null {
  return props.open ? <EnrollmentDialog {...props} /> : null;
}

function EnrollmentDialog(props: NewStudentDialogProps): ReactJSX.Element {
  const model = useEnrollmentController(props);
  const showUploadHint =
    model.step === "student" &&
    !model.confirmation &&
    !model.discarding &&
    (!props.existingStudentId || Boolean(model.existing.data && model.existingPending.data));
  useEffect(() => {
    if (!showUploadHint) return;
    let dismissHint: (() => void) | undefined;
    const timer = globalThis.setTimeout(() => {
      dismissHint = showMobileUploadHint();
    }, MOBILE_HINT_DELAY_MS);
    return () => {
      globalThis.clearTimeout(timer);
      dismissHint?.();
    };
  }, [showUploadHint]);
  return <EnrollmentDialogView model={model} />;
}

function useEnrollmentController(props: NewStudentDialogProps): EnrollmentModel {
  const today = toDateOnlySaoPaulo(new Date());
  const { identity, flow, documents } = useEnrollmentDraft(props);
  const contractData = useEnrollmentContract(flow);
  const { existingSources, leadSources, classSources } = useEnrollmentSources({
    existingStudentId: props.existingStudentId,
    identity,
    flow,
    today,
  });
  useEffect(() => {
    if (existingSources.existingContract && flow.step === "contract") flow.setStep("pedagogy");
  }, [existingSources.existingContract, flow.step, flow.setStep]);
  const navigation = createEnrollmentNavigation({
    identity,
    flow,
    documents,
    classes: classSources,
    today,
    existingStudentId: props.existingStudentId,
    saveBeforeClose: () => requestSave(false, true),
    onOpenChange: props.onOpenChange,
  });
  const { persistence, requestSave } = useEnrollmentSave({
    props,
    documents,
    identity,
    flow,
    contractData,
    classSources,
    existingSources,
    navigation,
  });
  const stepCompletion = intakeStepCompletion({
    documents,
    fields: identity.state.fields,
    today,
    existingStudentId: props.existingStudentId,
  });
  return {
    documents,
    stepCompletion,
    existingStudentId: props.existingStudentId,
    onOpenChange: props.onOpenChange,
    today,
    requestSave,
    ...identity,
    ...flow,
    ...contractData,
    ...existingSources,
    ...leadSources,
    ...classSources,
    ...navigation,
    ...persistence,
    pending: persistence.pending || identity.addressPending || documents.captureBusy,
  };
}

function useEnrollmentSave({
  props,
  documents,
  identity,
  flow,
  contractData,
  classSources,
  existingSources,
  navigation,
}: {
  props: NewStudentDialogProps;
  documents: EnrollmentDocuments;
  identity: EnrollmentIdentity;
  flow: EnrollmentFlow;
  contractData: EnrollmentContract;
  classSources: ClassSources;
  existingSources: ExistingSources;
  navigation: EnrollmentNavigation;
}): { persistence: EnrollmentPersistence; requestSave: ReturnType<typeof createRequestSave> } {
  const persistence = useEnrollmentPersistence({
    documentSessionId: documents.session?.id,
    flow,
    onCreated: props.onCreated,
    onOpenChange: props.onOpenChange,
  });
  const requestSave = createRequestSave({
    identity,
    flow,
    documents,
    contractData,
    classes: classSources,
    existing: existingSources,
    navigation,
    persistence,
    existingStudentId: props.existingStudentId,
    today: toDateOnlySaoPaulo(new Date()),
  });
  return { persistence, requestSave };
}

function useEnrollmentDraft(props: NewStudentDialogProps): {
  identity: EnrollmentIdentity;
  flow: EnrollmentFlow;
  documents: EnrollmentDocuments;
} {
  const baseIdentity = useEnrollmentIdentity(props.initialCandidateId);
  const flow = useEnrollmentFlow(props.initialStep);
  const documents = useEnrollmentDocuments({
    identity: baseIdentity,
    flow,
    studentId: props.existingStudentId,
  });
  const identity = { ...baseIdentity, dispatch: documents.dispatch };
  return { identity, flow, documents };
}
