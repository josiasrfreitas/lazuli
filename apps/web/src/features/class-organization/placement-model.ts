"use client";

import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
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
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  });
  const changes = placementChanges({ data, board, draft, validation });
  const source = data.progress.find((item) => item.id === draft.sourceId);
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const values = validation.validate(
      semesterPlacementSchema,
      placementInput({ data, row, board, draft }),
    );
    if (values && !mutation.isPending) mutation.mutate(values);
  };
  return {
    sourceId: draft.sourceId,
    mode: draft.mode,
    stageId: draft.stageId,
    planId: draft.planId,
    effectiveDate: draft.effectiveDate,
    notes: draft.notes,
    source,
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
  const mode = initialMode(row, source);
  const stageId = initialStageId({ data, row, source });
  const planId = initialPlanId ?? row?.planId ?? "pending";
  const effectiveDate = initialEffectiveDate(row, board);
  const notes = row?.notes ?? "";
  return { sourceId, mode, stageId, planId, effectiveDate, notes };
}

function initialSourceId(row: Placement | undefined, source: Progress | undefined): string {
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
      setMode(progress ? "CONTINUE" : "ENTRY", progress);
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
