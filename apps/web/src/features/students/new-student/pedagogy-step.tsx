import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { studentPedagogyIntakeSchema, type StudentPedagogyIntake } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import type { SlotDraft } from "~/features/semester-organization/slot-fields";
import { PedagogyStepForm } from "./pedagogy-step-form";
import { usePedagogySemester } from "./use-pedagogy-semester";

export type PedagogyDraft = {
  semesterId: string;
  stageId: string;
  format: "IN_PERSON" | "ONLINE";
  slots: SlotDraft[];
  notes: string;
};
export const emptyPedagogyDraft = (semesterId = ""): PedagogyDraft => ({
  semesterId,
  stageId: "",
  format: "IN_PERSON",
  slots: [],
  notes: "",
});
export function pedagogyIntake(draft: PedagogyDraft): StudentPedagogyIntake {
  if (!draft.semesterId) throw new Error("Escolha o semestre de entrada do aluno.");
  return studentPedagogyIntakeSchema.parse({
    semesterId: draft.semesterId,
    stageId: draft.stageId || null,
    planId: null,
    formats: [draft.format],
    slots: draft.slots,
    notes: draft.notes,
  });
}
export function PedagogyStep({
  draft,
  onChange,
  onSubmit,
}: {
  draft: PedagogyDraft;
  onChange: (draft: PedagogyDraft) => void;
  onSubmit: () => void;
}): ReactJSX.Element {
  const semester = usePedagogySemester(draft, onChange);
  const options = trpc.classes.formOptions.useQuery();
  const [error, setError] = useState("");
  const [semesterError, setSemesterError] = useState("");
  const [stageQuery, setStageQuery] = useState("");
  const set = (patch: Partial<PedagogyDraft>): void => {
    onChange({ ...draft, ...patch });
    setError("");
  };
  return (
    <PedagogyStepForm
      draft={draft}
      semester={semester}
      options={options}
      error={error}
      semesterError={semesterError}
      stageQuery={stageQuery}
      set={set}
      setError={setError}
      setSemesterError={setSemesterError}
      setStageQuery={setStageQuery}
      onSubmit={onSubmit}
    />
  );
}
