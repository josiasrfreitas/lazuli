"use client";

import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { compatible } from "./model";
import { semesterPlacementSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { useValidation } from "~/features/shared/task-form";
import {
  dateOnly,
  modes,
  useOrganizationRefresh,
  type Placement,
  type OrganizationBoard,
  type StudentContext,
} from "./shared";

type Progress = StudentContext["progress"][number];
type Mode = keyof typeof modes;
export type PlacementProps = {
  data: StudentContext;
  row?: Placement | undefined;
  board: OrganizationBoard;
  initialPlanId?: string | undefined;
  onClose: () => void;
  onFeedback: (message: string) => void;
};
type PlacementDraft = {
  sourceId: string;
  setSourceId: Dispatch<SetStateAction<string>>;
  mode: Mode;
  setMode: Dispatch<SetStateAction<Mode>>;
  stageId: string;
  setStageId: Dispatch<SetStateAction<string>>;
  planId: string;
  setPlanId: Dispatch<SetStateAction<string>>;
  effectiveDate: string;
  setEffectiveDate: Dispatch<SetStateAction<string>>;
  notes: string;
  setNotes: Dispatch<SetStateAction<string>>;
};
export type PlacementModel = Pick<
  PlacementDraft,
  "sourceId" | "mode" | "stageId" | "planId" | "effectiveDate" | "notes"
> & {
  source: Progress | undefined;
  regularRollover: boolean;
  individualStage: boolean;
  validation: ReturnType<typeof useValidation>;
  pending: boolean;
  error: string | undefined;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  changeSource: (value: string) => void;
  changeMode: (value: Mode) => void;
  changePlan: (value: string) => void;
  changeStage: (value: string) => void;
  changeDate: (value: string) => void;
  changeNotes: (value: string) => void;
};
type PlacementChanges = Pick<
  PlacementModel,
  "changeSource" | "changeMode" | "changePlan" | "changeStage" | "changeDate" | "changeNotes"
>;

export function usePlacementModel(props: PlacementProps): PlacementModel {
  const { data, row, board, onClose } = props;
  const draft = usePlacementDraft(props);
  const validation = useValidation();
  const refresh = useOrganizationRefresh();
  const mutation = trpc.semesterOrganization.savePlacement.useMutation({
    onSuccess: async (_, input) => {
      await refresh();
      const destination = board.plans.find((plan) => plan.id === input.planId);
      const starts = formatDateOnlyBR(input.effectiveDate ?? dateOnly(board.semester.startDate));
      props.onFeedback(
        destination
          ? `Proposta salva para ${data.student.fullName}. ${destination.className ?? destination.name} a partir de ${starts}.`
          : `Proposta salva. ${data.student.fullName} aguarda uma turma de destino.`,
      );
      onClose();
    },
  });
  const changes = placementChanges({ data, board, draft, validation });
  const source = data.progress.find((item) => item.id === draft.sourceId);
  const plan = board.plans.find((item) => item.id === draft.planId);
  const regularDestination = plan?.scheduleType === "REGULAR";
  const stageId = regularDestination ? (plan.sharedStageId ?? "pending") : draft.stageId;
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const values = validation.validate(
      semesterPlacementSchema,
      placementInput({ data, row, board, draft: { ...draft, stageId } }),
    );
    if (values && !mutation.isPending) mutation.mutate(values);
  };
  return {
    sourceId: draft.sourceId,
    mode: draft.mode,
    stageId,
    planId: draft.planId,
    effectiveDate: draft.effectiveDate,
    notes: draft.notes,
    source,
    regularRollover: isRegularRollover(source, board),
    individualStage: !regularDestination && (Boolean(plan) || !isRegularRollover(source, board)),
    validation,
    pending: mutation.isPending,
    error: mutation.error?.message,
    submit,
    ...changes,
  };
}

function usePlacementDraft(props: PlacementProps): PlacementDraft {
  const initial = initialPlacement(props);
  const [sourceId, setSourceId] = useState(initial.sourceId);
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [stageId, setStageId] = useState(initial.stageId);
  const [planId, setPlanId] = useState(initial.planId);
  const [effectiveDate, setEffectiveDate] = useState(initial.effectiveDate);
  const [notes, setNotes] = useState(initial.notes);
  return {
    sourceId,
    setSourceId,
    mode,
    setMode,
    stageId,
    setStageId,
    planId,
    setPlanId,
    effectiveDate,
    setEffectiveDate,
    notes,
    setNotes,
  };
}

function initialPlacement({
  data,
  row,
  board,
  initialPlanId,
}: PlacementProps): Pick<
  PlacementDraft,
  "sourceId" | "mode" | "stageId" | "planId" | "effectiveDate" | "notes"
> {
  const source =
    data.progress.find((item) => item.id === row?.sourceProgressId) ?? data.progress[0];
  const sourceId = initialSourceId(row, source);
  const storedMode = initialMode(row, source);
  const mode =
    storedMode === "CONTINUE" && isRegularRollover(source, board) ? "ADVANCE" : storedMode;
  const stageId =
    row?.stageId || mode === storedMode
      ? initialStageId({ data, row, source })
      : nextStageId({ next: mode, progress: source, data });
  const suggested = board.plans.find((plan) => plan.id === initialPlanId);
  const allowed =
    suggested?.active && (!row || row.continuity !== "CHANGE" || compatible(row, suggested));
  const planId =
    (allowed ? initialPlanId : undefined) ??
    (row?.continuity === "CHANGE" ? null : row?.planId) ??
    "pending";
  const effectiveDate = initialEffectiveDate(row, board);
  const notes = row?.notes ?? "";
  return { sourceId, mode, stageId, planId, effectiveDate, notes };
}

function isRegularRollover(source: Progress | undefined, board: OrganizationBoard): boolean {
  const sourceClass = source?.enrollment.class;
  return sourceClass?.scheduleType === "REGULAR" && sourceClass.semesterId !== board.semester.id;
}

function initialSourceId(row: Placement | undefined, source: Progress | undefined): string {
  if (row?.classClosurePending && row.mode === "ENTRY") return "new";
  return row ? (row.sourceProgressId ?? "new") : (source?.id ?? "new");
}

function initialMode(row: Placement | undefined, source: Progress | undefined): Mode {
  return row?.mode ?? (source ? "CONTINUE" : "ENTRY");
}

function initialStageId({
  data,
  row,
  source,
}: {
  data: StudentContext;
  row: Placement | undefined;
  source: Progress | undefined;
}): string {
  if (row) return row.stageId ?? "pending";
  return source?.stageId ?? data.lead?.stageId ?? "pending";
}

function initialEffectiveDate(row: Placement | undefined, board: OrganizationBoard): string {
  const start = row?.effectiveDate
    ? dateOnly(row.effectiveDate)
    : dateOnly(board.semester.startDate);
  return formatDateOnlyBR([start, toDateOnlySaoPaulo(new Date())].toSorted().at(-1));
}

function placementInput({
  data,
  row,
  board,
  draft,
}: {
  data: StudentContext;
  row: Placement | undefined;
  board: OrganizationBoard;
  draft: PlacementDraft;
}): {
  id?: string;
  version: number;
  semesterId: string;
  studentId: string;
  planId: string | null;
  stageId: string | null;
  sourceProgressId: string | null;
  mode: Mode;
  effectiveDate: string;
  notes: string;
} {
  return {
    ...(row ? { id: row.id } : {}),
    version: row?.version ?? 0,
    semesterId: board.semester.id,
    studentId: data.student.id,
    planId: draft.planId === "pending" ? null : draft.planId,
    stageId: draft.stageId === "pending" ? null : draft.stageId,
    sourceProgressId: draft.sourceId === "new" ? null : draft.sourceId,
    mode: draft.mode,
    effectiveDate: parseDateBR(draft.effectiveDate) ?? "",
    notes: draft.notes,
  };
}

function placementChanges({
  data,
  board,
  draft,
  validation,
}: {
  data: StudentContext;
  board: OrganizationBoard;
  draft: PlacementDraft;
  validation: ReturnType<typeof useValidation>;
}): PlacementChanges {
  const setMode = (next: Mode, progress: Progress | undefined): void => {
    draft.setMode(next);
    draft.setStageId(nextStageId({ next, progress, data }));
    validation.clear("stageId");
    validation.clear("mode");
  };
  return {
    changeSource: (value) => {
      draft.setSourceId(value);
      const progress = data.progress.find((item) => item.id === value);
      const next = !progress
        ? "ENTRY"
        : isRegularRollover(progress, board)
          ? "ADVANCE"
          : "CONTINUE";
      setMode(next, progress);
    },
    changeMode: (next) =>
      setMode(
        next,
        data.progress.find((item) => item.id === draft.sourceId),
      ),
    changePlan: (value) => {
      draft.setPlanId(value);
      const plan = board.plans.find((item) => item.id === value);
      if (plan?.sharedStageId) draft.setStageId(plan.sharedStageId);
      validation.clear("planId");
    },
    changeStage: (value) => {
      draft.setStageId(value);
      validation.clear("stageId");
    },
    changeDate: (value) => {
      draft.setEffectiveDate(maskDateBR(value));
      validation.clear("effectiveDate");
    },
    changeNotes: (value) => {
      draft.setNotes(value);
      validation.clear("notes");
    },
  };
}

function nextStageId({
  next,
  progress,
  data,
}: {
  next: Mode;
  progress: Progress | undefined;
  data: StudentContext;
}): string {
  if (!progress) return data.lead?.stageId ?? "pending";
  if (next !== "ADVANCE") return progress.stageId;
  return (
    progress.stage.track.stages.find((item) => item.sequence === progress.stage.sequence + 1)?.id ??
    "pending"
  );
}
