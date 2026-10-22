"use client";
import type { JSX as ReactJSX } from "react";
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

export type IntakeStep = "student" | "pedagogy" | "contract";

export type NewStudentDialogProps = {
  open: boolean;
  initialSemesterId?: string;
  initialCandidateId?: string;
  existingStudentId?: string | undefined;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
};

export type EnrollmentModel = {
  existingStudentId: string | undefined;
  onOpenChange: (open: boolean) => void;
  today: string;
  requestSave: (withContract: boolean) => void;
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
  return <EnrollmentDialogView model={model} />;
}

function useEnrollmentController(props: NewStudentDialogProps): EnrollmentModel {
  const today = toDateOnlySaoPaulo(new Date());
  const identity = useEnrollmentIdentity(props.initialCandidateId);
  const flow = useEnrollmentFlow();
  const contractData = useEnrollmentContract(flow);
  const { existingSources, leadSources, classSources } = useEnrollmentSources({
    existingStudentId: props.existingStudentId,
    identity,
    flow,
    today,
  });
  const navigation = createEnrollmentNavigation({
    identity,
    flow,
    classes: classSources,
    today,
    onOpenChange: props.onOpenChange,
  });
  const persistence = useEnrollmentPersistence({
    flow,
    onCreated: props.onCreated,
    onOpenChange: props.onOpenChange,
  });
  const requestSave = createRequestSave({
    identity,
    flow,
    contractData,
    classes: classSources,
    existing: existingSources,
    navigation,
    persistence,
    existingStudentId: props.existingStudentId,
  });
  return {
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
  };
}
