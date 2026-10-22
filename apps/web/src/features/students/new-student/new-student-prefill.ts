import type { RouterOutputs } from "@lazuli/api";
import { formatDateOnlyBR } from "~/lib/format";
import { dateLabel } from "~/features/admissions/labels";
import { initialNewStudentState, type NewStudentFields } from "./reducer";

type ExistingStudent = NonNullable<RouterOutputs["students"]["byId"]>;
type PendingActions = NonNullable<RouterOutputs["students"]["pendingActions"]>;
type Lead = NonNullable<RouterOutputs["admissions"]["byId"]>;

export function existingStudentFields(student: ExistingStudent): NewStudentFields {
  const { contact, guardian } = student;
  return {
    fullName: contact.fullName,
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    documentType: contact.documentType ?? "",
    documentNumber: contact.documentNumber ?? "",
    birthDate: formatDateOnlyBR(contact.birthDate ?? undefined),
    ...existingGuardianFields(guardian),
  };
}

function existingGuardianFields(
  guardian: ExistingStudent["guardian"],
): Pick<NewStudentFields, "guardianName" | "guardianPhone" | "guardianEmail"> {
  return {
    guardianName: guardian?.fullName ?? "",
    guardianPhone: guardian?.phone ?? "",
    guardianEmail: guardian?.email ?? "",
  };
}

export function existingStudentSelections(pending: PendingActions): {
  candidateId: string | null;
  stageId: string | null;
  format: "IN_PERSON" | "ONLINE";
  scheduleType: "REGULAR" | "PERSONALIZED";
} {
  const linked = pending.lead;
  const enrollmentClass = pending.enrollment?.class;
  return {
    candidateId: linked?.id ?? null,
    stageId: linked?.stageId ?? enrollmentClass?.sharedStage?.id ?? null,
    ...existingClassFormat(pending),
  };
}

function existingClassFormat(
  pending: PendingActions,
): Pick<ReturnType<typeof existingStudentSelections>, "format" | "scheduleType"> {
  const linked = pending.lead;
  const enrollmentClass = pending.enrollment?.class;
  return {
    format: enrollmentClass?.format ?? linked?.format ?? "IN_PERSON",
    scheduleType: enrollmentClass?.scheduleType ?? linked?.scheduleType ?? "REGULAR",
  };
}

function leadContactFields(
  lead: Lead,
): Pick<NewStudentFields, "phone" | "email" | "guardianName" | "guardianPhone" | "guardianEmail"> {
  const guardianContact = lead.contactOwner === "GUARDIAN";
  return {
    phone: guardianContact ? "" : (lead.phone ?? ""),
    email: guardianContact ? "" : (lead.email ?? ""),
    ...leadGuardianFields(lead),
  };
}

function leadGuardianFields(
  lead: Lead,
): Pick<NewStudentFields, "guardianName" | "guardianPhone" | "guardianEmail"> {
  const guardianContact = lead.contactOwner === "GUARDIAN";
  return {
    guardianName:
      lead.contactRole === "GUARDIAN" || guardianContact ? (lead.contactName ?? "") : "",
    guardianPhone: guardianContact ? (lead.phone ?? "") : "",
    guardianEmail: guardianContact ? (lead.email ?? "") : "",
  };
}

export function leadStudentFields(lead: Lead): NewStudentFields {
  return {
    ...initialNewStudentState.fields,
    fullName: lead.fullName,
    birthDate: lead.birthDate ? dateLabel(lead.birthDate) : "",
    ...leadContactFields(lead),
  };
}

export function leadStudentSelections(lead: Lead): {
  stageId: string | null;
  format: "IN_PERSON" | "ONLINE";
  scheduleType: "REGULAR" | "PERSONALIZED";
  selectedId: string;
} {
  return {
    stageId: lead.stageId,
    format: lead.format ?? "IN_PERSON",
    scheduleType: lead.scheduleType ?? "REGULAR",
    selectedId: lead.allocationPlan?.classId ?? "",
  };
}
