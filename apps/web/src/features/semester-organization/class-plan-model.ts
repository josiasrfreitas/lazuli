"use client";

import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { semesterPlanSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { useValidation } from "~/features/shared/task-form";
import type { PendingGroup } from "~/features/class-organization/model";
import { useOrganizationRefresh, type ClassPlan } from "./shared";
import type { SlotDraft } from "./slot-fields";

export type ClassPlanProps = {
  semesterId: string;
  plan?: ClassPlan | undefined;
  group?: PendingGroup | undefined;
  onClose: () => void;
  onSaved: (id: string) => void;
};
type Draft = {
  name: string;
  setName: Dispatch<SetStateAction<string>>;
  kind: ClassPlan["scheduleType"];
  setKind: Dispatch<SetStateAction<ClassPlan["scheduleType"]>>;
  format: ClassPlan["format"];
  setFormat: Dispatch<SetStateAction<ClassPlan["format"]>>;
  teacher: string;
  setTeacher: Dispatch<SetStateAction<string>>;
  stage: string;
  setStage: Dispatch<SetStateAction<string>>;
  selected: string[];
  setSelected: Dispatch<SetStateAction<string[]>>;
  slots: SlotDraft[];
  setSlots: Dispatch<SetStateAction<SlotDraft[]>>;
};
export type ClassPlanModel = Pick<
  Draft,
  "name" | "kind" | "format" | "teacher" | "stage" | "selected" | "slots"
> & {
  validation: ReturnType<typeof useValidation>;
  pending: boolean;
  error: string | undefined;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  changeName: (value: string) => void;
  changeKind: (value: string) => void;
  changeFormat: (value: string) => void;
  changeTeacher: (value: string) => void;
  changeStage: (value: string) => void;
  changeSlots: (slots: SlotDraft[]) => void;
  togglePerson: (id: string, selected: boolean) => void;
};
type ClassPlanChanges = Pick<
  ClassPlanModel,
  | "changeName"
  | "changeKind"
  | "changeFormat"
  | "changeTeacher"
  | "changeStage"
  | "changeSlots"
  | "togglePerson"
>;

export function useClassPlanModel(props: ClassPlanProps): ClassPlanModel {
  const draft = useClassPlanDraft(props);
  const validation = useValidation();
  const refresh = useOrganizationRefresh();
  const mutation = trpc.semesterOrganization.savePlan.useMutation({
    onSuccess: async (result) => {
      await refresh();
      props.onSaved(result.id);
      props.onClose();
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const values = validation.validate(semesterPlanSchema, classPlanInput(props, draft));
    if (values && !mutation.isPending) mutation.mutate(values);
  };
  return {
    name: draft.name,
    kind: draft.kind,
    format: draft.format,
    teacher: draft.teacher,
    stage: draft.stage,
    selected: draft.selected,
    slots: draft.slots,
    validation,
    pending: mutation.isPending,
    error: mutation.error?.message,
    submit,
    ...classPlanChanges({ draft, validation }),
  };
}

function classPlanChanges({
  draft,
  validation,
}: {
  draft: Draft;
  validation: ReturnType<typeof useValidation>;
}): ClassPlanChanges {
  return {
    changeName: (value) => {
      draft.setName(value);
      validation.clear("name");
    },
    changeKind: (value) => {
      draft.setKind(value as Draft["kind"]);
      validation.clear("sharedStageId");
    },
    changeFormat: (value) => draft.setFormat(value as Draft["format"]),
    changeTeacher: (value) => {
      draft.setTeacher(value);
      validation.clear("teacherId");
    },
    changeStage: (value) => {
      draft.setStage(value);
      validation.clear("sharedStageId");
    },
    changeSlots: (value) => {
      draft.setSlots(value);
      validation.clear("slots");
    },
    togglePerson: (id, selected) =>
      draft.setSelected((current) =>
        selected ? [...current, id] : current.filter((currentId) => currentId !== id),
      ),
  };
}

function useClassPlanDraft({ plan, group }: ClassPlanProps): Draft {
  const initial = initialClassPlan({ plan, group });
  const [name, setName] = useState(initial.name);
  const [kind, setKind] = useState(initial.kind);
  const [format, setFormat] = useState(initial.format);
  const [teacher, setTeacher] = useState(initial.teacher);
  const [stage, setStage] = useState(initial.stage);
  const [selected, setSelected] = useState(initial.selected);
  const [slots, setSlots] = useState(initial.slots);
  return {
    name,
    setName,
    kind,
    setKind,
    format,
    setFormat,
    teacher,
    setTeacher,
    stage,
    setStage,
    selected,
    setSelected,
    slots,
    setSlots,
  };
}

function initialClassPlan({
  plan,
  group,
}: Pick<ClassPlanProps, "plan" | "group">): Pick<
  Draft,
  "name" | "kind" | "format" | "teacher" | "stage" | "selected" | "slots"
> {
  return {
    ...initialPlanFields(plan),
    name: initialClassName({ plan, group }),
    stage: initialStage({ plan, group }),
    selected: initialSelected(group),
  };
}

function initialPlanFields(
  plan: ClassPlan | undefined,
): Pick<Draft, "kind" | "format" | "teacher" | "slots"> {
  return {
    kind: plan?.scheduleType ?? "REGULAR",
    format: plan?.format ?? "IN_PERSON",
    teacher: plan?.teacherId ?? "pending",
    slots: plan?.slots ?? [
      { weekday: "MONDAY", startTime: "", endTime: "" },
      { weekday: "WEDNESDAY", startTime: "", endTime: "" },
    ],
  };
}

function initialClassName({ plan, group }: Pick<ClassPlanProps, "plan" | "group">): string {
  if (plan) return plan.name;
  return group ? `${group.stageCode} · nova turma` : "";
}

function initialStage({ plan, group }: Pick<ClassPlanProps, "plan" | "group">): string {
  return plan?.sharedStageId ?? group?.stageId ?? "";
}

function initialSelected(group: PendingGroup | undefined): string[] {
  return [
    ...(group?.rows.map((row) => row.id) ?? []),
    ...(group?.leads.map((lead) => lead.id) ?? []),
  ];
}

function classPlanInput(
  { plan, group, semesterId }: ClassPlanProps,
  draft: Draft,
): {
  id?: string;
  version: number;
  semesterId: string;
  name: string;
  scheduleType: ClassPlan["scheduleType"];
  format: ClassPlan["format"];
  teacherId: string | null;
  sharedStageId: string | null;
  slots: SlotDraft[];
  placements: { id: string; version: number }[];
  leadIds: string[];
} {
  return {
    ...(plan ? { id: plan.id } : {}),
    version: plan?.version ?? 0,
    semesterId,
    name: draft.name,
    scheduleType: draft.kind,
    format: draft.format,
    teacherId: draft.teacher === "pending" ? null : draft.teacher,
    sharedStageId: draft.kind === "REGULAR" ? draft.stage || null : null,
    slots: draft.slots,
    ...selectedGroupMembers({ group, selected: draft.selected }),
  };
}

function selectedGroupMembers({
  group,
  selected,
}: {
  group: PendingGroup | undefined;
  selected: string[];
}): { placements: { id: string; version: number }[]; leadIds: string[] } {
  return {
    placements:
      group?.rows
        .filter((row) => selected.includes(row.id))
        .map(({ id, version }) => ({ id, version })) ?? [],
    leadIds: group?.leads.filter((lead) => selected.includes(lead.id)).map((lead) => lead.id) ?? [],
  };
}
