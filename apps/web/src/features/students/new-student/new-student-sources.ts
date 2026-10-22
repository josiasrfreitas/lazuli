import { useEffect } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { getScheduleCalendarRange } from "@lazuli/ui";
import { trpc, type QueryResult } from "~/lib/trpc";
import { isMinorFromFields, type NewStudentFieldName } from "./reducer";
import type { EnrollmentIdentity, EnrollmentFlow } from "./new-student-state";
import {
  existingStudentFields,
  existingStudentSelections,
  leadStudentFields,
  leadStudentSelections,
} from "./new-student-prefill";

const DUPLICATE_SEARCH_DEBOUNCE_MS = 250;
type ExistingStudent = RouterOutputs["students"]["byId"];
type PendingActions = RouterOutputs["students"]["pendingActions"];
type Lead = RouterOutputs["admissions"]["byId"];
type Leads = RouterOutputs["admissions"]["list"];
type Options = RouterOutputs["students"]["intakeOptions"];

function useDebouncedLeadSearch(identity: EnrollmentIdentity): void {
  const { state, setSearch } = identity;
  useEffect(() => {
    const timer = setTimeout(
      () => setSearch(state.fields.fullName.trim()),
      DUPLICATE_SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [state.fields.fullName]);
}

export type ExistingSources = {
  existing: QueryResult<ExistingStudent>;
  existingPending: QueryResult<PendingActions>;
  existingEnrollment: NonNullable<PendingActions>["enrollment"] | undefined;
  existingContract: NonNullable<PendingActions>["contract"] | undefined;
};

export function useExistingSources({
  existingStudentId,
  identity,
}: {
  existingStudentId: string | undefined;
  identity: EnrollmentIdentity;
}): ExistingSources {
  const { dispatch, prefilled, setCandidateId, setStageId, setFormat, setScheduleType } = identity;
  const existing = trpc.students.byId.useQuery(
    { id: existingStudentId ?? "" },
    { enabled: Boolean(existingStudentId), retry: false },
  );
  const existingPending = trpc.students.pendingActions.useQuery(
    { id: existingStudentId ?? "" },
    { enabled: Boolean(existingStudentId), retry: false },
  );
  useEffect(() => {
    if (
      !existingStudentId ||
      !existing.data ||
      !existingPending.data ||
      prefilled.current === existingStudentId
    )
      return;
    prefilled.current = existingStudentId;
    for (const [field, value] of Object.entries(existingStudentFields(existing.data)))
      dispatch({ type: "fieldChanged", field: field as NewStudentFieldName, value });
    const selection = existingStudentSelections(existingPending.data);
    setCandidateId(selection.candidateId);
    setStageId(selection.stageId);
    setFormat(selection.format);
    setScheduleType(selection.scheduleType);
  }, [existingStudentId, existing.data, existingPending.data]);
  return {
    existing,
    existingPending,
    existingEnrollment: existingPending.data?.enrollment,
    existingContract: existingPending.data?.contract,
  };
}

export type LeadSources = {
  candidate: QueryResult<Lead>;
  lead: Lead | undefined;
  leads: QueryResult<Leads>;
};

export function useLeadSources({
  existingStudentId,
  identity,
}: {
  existingStudentId: string | undefined;
  identity: EnrollmentIdentity;
}): LeadSources {
  const {
    candidateId,
    draftLead,
    search,
    prefilled,
    dispatch,
    setStageId,
    setFormat,
    setScheduleType,
    setSelectedId,
  } = identity;
  const candidate = trpc.admissions.byId.useQuery(
    { id: candidateId ?? "" },
    { enabled: Boolean(candidateId), retry: false },
  );
  const lead = candidate.data?.id === candidateId ? candidate.data : undefined;
  useDebouncedLeadSearch(identity);
  const leads = trpc.admissions.list.useQuery(
    { search, statuses: ["WAITING"], unlinkedOnly: true, pageSize: 8 },
    {
      enabled: !existingStudentId && !candidateId && !draftLead && search.length >= 2,
      retry: false,
    },
  );
  useEffect(() => {
    if (existingStudentId || !lead || prefilled.current === lead.id) return;
    prefilled.current = lead.id;
    dispatch({ type: "reset" });
    for (const [field, value] of Object.entries(leadStudentFields(lead)))
      dispatch({ type: "fieldChanged", field: field as NewStudentFieldName, value });
    const selection = leadStudentSelections(lead);
    setStageId(selection.stageId);
    setFormat(selection.format);
    setScheduleType(selection.scheduleType);
    setSelectedId(selection.selectedId);
  }, [lead, existingStudentId]);
  return { candidate, lead, leads };
}

export type ClassSources = {
  options: QueryResult<Options>;
  selected: Options["classes"][number] | undefined;
  minor: boolean;
  blockedLead: boolean;
  waitingPlacement: boolean;
};

export function useEnrollmentSources({
  existingStudentId,
  identity,
  flow,
  today,
}: {
  existingStudentId: string | undefined;
  identity: EnrollmentIdentity;
  flow: EnrollmentFlow;
  today: string;
}): {
  existingSources: ExistingSources;
  leadSources: LeadSources;
  classSources: ClassSources;
} {
  const existingSources = useExistingSources({ existingStudentId, identity });
  const leadSources = useLeadSources({ existingStudentId, identity });
  const classSources = useClassSources({
    existingStudentId,
    identity,
    flow,
    lead: leadSources.lead,
    today,
  });
  return { existingSources, leadSources, classSources };
}

export function useClassSources({
  existingStudentId,
  identity,
  flow,
  lead,
  today,
}: {
  existingStudentId: string | undefined;
  identity: EnrollmentIdentity;
  flow: EnrollmentFlow;
  lead: Lead | undefined;
  today: string;
}): ClassSources {
  const { stageId, format, scheduleType, selectedId, candidateId } = identity;
  const range = getScheduleCalendarRange({ date: today, view: "week" });
  const options = trpc.students.intakeOptions.useQuery(
    { stageId, format, scheduleType, from: range.from, through: range.through },
    { enabled: flow.step !== "student", retry: false },
  );
  const selected = options.data?.classes.find((row) => row.id === selectedId);
  const minor = minorIntakeStudent(identity, { lead, today });
  const blockedLead = blockedIntakeLead({ existingStudentId, candidateId, lead });
  const waitingPlacement = waitingIntakePlacement(identity, lead);
  return { options, selected, minor, blockedLead, waitingPlacement };
}

function minorIntakeStudent(
  identity: EnrollmentIdentity,
  { lead, today }: { lead: Lead | undefined; today: string },
): boolean {
  return (
    isMinorFromFields(identity.state.fields, today) ||
    lead?.contactRole === "GUARDIAN" ||
    identity.draftLead?.lead.contactRole === "GUARDIAN"
  );
}

function blockedIntakeLead({
  existingStudentId,
  candidateId,
  lead,
}: {
  existingStudentId: string | undefined;
  candidateId: string | null;
  lead: Lead | undefined;
}): boolean {
  return (
    !existingStudentId &&
    Boolean(candidateId && (!lead || lead.studentId || lead.status !== "WAITING"))
  );
}

function waitingIntakePlacement(identity: EnrollmentIdentity, lead: Lead | undefined): boolean {
  return (
    identity.draftLead?.lead.englishExperience === "SOME" ||
    (lead?.englishExperience === "SOME" && !lead.stageId)
  );
}
