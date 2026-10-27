import { previewContractInput } from "~/features/contracts/contract-form-model";
import { fieldErrors } from "~/features/contracts/new-contract-state";
import type { EnrollmentNavigation } from "./new-student-navigation";
import type { EnrollmentPersistence } from "./new-student-persistence";
import type { ClassSources, ExistingSources } from "./new-student-sources";
import type { EnrollmentContract, EnrollmentFlow, EnrollmentIdentity } from "./new-student-state";
import {
  intakeContract,
  intakePendingItems,
  intakeSaveIssue,
  parseIntakeCommand,
} from "./new-student-save";

type SaveContext = {
  identity: EnrollmentIdentity;
  flow: EnrollmentFlow;
  contractData: EnrollmentContract;
  classes: ClassSources;
  existing: ExistingSources;
  navigation: EnrollmentNavigation;
  persistence: EnrollmentPersistence;
  existingStudentId: string | undefined;
};
type ParsedContract = ReturnType<typeof intakeContract>;

function canBeginSave(context: SaveContext, closing: boolean): boolean {
  const { flow, navigation, classes, identity } = context;
  if (flow.busy.current || (!closing && flow.step !== "contract")) return false;
  if (!navigation.validateStudent(!closing)) {
    if (!closing) flow.setStep("student");
    return false;
  }
  const issue = intakeSaveIssue({
    blockedLead: classes.blockedLead,
    selectedId: identity.selectedId,
    optionsFetching: classes.options.isFetching,
    selected: Boolean(classes.selected),
    stageId: identity.stageId,
    waitingPlacement: classes.waitingPlacement,
  });
  if (!issue) return true;
  if (!closing) flow.setError(issue);
  return false;
}

function contractReady(context: SaveContext, parsedContract: ParsedContract): boolean {
  if (!parsedContract) return true;
  const { contract, offer } = context.contractData;
  const preview = previewContractInput(parsedContract, offer.data);
  if (parsedContract.success && preview) return true;
  contract.setErrors(fieldErrors(parsedContract, Boolean(preview)));
  requestAnimationFrame(() =>
    contract.popup.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
  );
  return false;
}

function prepareIntakeSave(
  context: SaveContext,
  {
    withContract,
    parsedContract,
  }: {
    withContract: boolean;
    parsedContract: ParsedContract;
  },
): {
  items: string[];
  parsed: ReturnType<typeof parseIntakeCommand>;
} {
  const { identity, flow, classes, existing, existingStudentId } = context;
  const items = intakePendingItems({
    selected: Boolean(classes.selected),
    existingEnrollment: Boolean(existing.existingEnrollment),
    waitingPlacement: classes.waitingPlacement,
    withContract,
    existingContract: Boolean(existing.existingContract),
  });
  const parsed = parseIntakeCommand({
    existingStudentId,
    fields: identity.state.fields,
    hasGuardian: Boolean(existing.existing.data?.guardian),
    commandId: flow.commandId,
    candidateId: identity.candidateId,
    draftLead: identity.draftLead,
    shared: {
      stageId: identity.stageId,
      classId: classes.selected?.id ?? null,
      contract: parsedContract?.success ? parsedContract.data : null,
      allowPending: items.length > 0,
    },
  });
  return { items, parsed };
}

export function createRequestSave(
  context: SaveContext,
): (withContract: boolean, closing?: boolean) => boolean {
  return (withContract, closing = false) => {
    if (!canBeginSave(context, closing)) return false;
    const { identity, flow, contractData, existingStudentId, existing, persistence } = context;
    const parsedContract = intakeContract({
      withContract,
      existingContract: Boolean(existing.existingContract),
      existingStudentId,
      fields: contractData.contract.fields,
      student: identity.state.fields,
      commandId: contractData.contract.commandId.current,
    });
    if (!contractReady(context, parsedContract)) return false;
    const { items, parsed } = prepareIntakeSave(context, { withContract, parsedContract });
    if (!parsed.input) {
      if (!closing) flow.setError(parsed.error);
      return false;
    }
    flow.setError("");
    if (closing || items.length > 0) flow.setConfirmation({ input: parsed.input, items });
    else void persistence.persist(parsed.input);
    return true;
  };
}
