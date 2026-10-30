import { previewContractInput } from "~/features/contracts/contract-form-model";
import { fieldErrors } from "~/features/contracts/new-contract-state";
import type { EnrollmentNavigation } from "./new-student-navigation";
import type { EnrollmentPersistence } from "./new-student-persistence";
import type { ClassSources, ExistingSources } from "./new-student-sources";
import { validateDados } from "./reducer";
import type { BlockingItem } from "./new-student-state";
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
  today: string;
};
type ParsedContract = ReturnType<typeof intakeContract>;

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
    if (context.flow.busy.current) return false;
    const { blocking, items } = initialSaveState(context, withContract);
    if (blocking.length > 0) {
      context.flow.setConfirmation({ items, blocking });
      return true;
    }
    const { identity, flow, contractData, existingStudentId, existing } = context;
    const parsedContract = intakeContract({
      withContract,
      existingContract: Boolean(existing.existingContract),
      existingStudentId,
      fields: contractData.contract.fields,
      student: identity.state.fields,
      commandId: contractData.contract.commandId.current,
    });
    if (!contractReady(context, parsedContract)) {
      context.flow.setConfirmation({
        items,
        blocking: [{ label: "Complete os dados obrigatórios do contrato.", step: "contract" }],
      });
      return true;
    }
    const { parsed } = prepareIntakeSave(context, { withContract, parsedContract });
    if (!parsed.input) {
      if (!closing) flow.setError(parsed.error);
      return false;
    }
    flow.setError("");
    flow.setConfirmation({ input: parsed.input, items, blocking: [] });
    return true;
  };
}

function initialSaveState(
  context: SaveContext,
  withContract: boolean,
): { blocking: BlockingItem[]; items: string[] } {
  const studentErrors = validateDados(context.identity.state.fields, context.today);
  const blocking: BlockingItem[] = Object.entries(studentErrors).map(([field, label]) => ({
    label,
    field,
    step: "student",
  }));
  const issue = intakeSaveIssue({
    blockedLead: context.classes.blockedLead,
    selectedId: context.identity.selectedId,
    optionsFetching: context.classes.options.isFetching,
    selected: Boolean(context.classes.selected),
    stageId: context.identity.stageId,
    waitingPlacement: context.classes.waitingPlacement,
  });
  if (issue)
    blocking.push({ label: issue, step: context.classes.blockedLead ? "student" : "pedagogy" });
  const items = intakePendingItems({
    selected: Boolean(context.classes.selected),
    existingEnrollment: Boolean(context.existing.existingEnrollment),
    waitingPlacement: context.classes.waitingPlacement,
    withContract,
    existingContract: Boolean(context.existing.existingContract),
  });
  return { blocking, items };
}
