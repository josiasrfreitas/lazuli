import { useState, type FormEvent, type Dispatch, type SetStateAction } from "react";
import { assessmentSaveSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { parseDateBR } from "~/lib/masks";
import { formatDateOnlyBR } from "~/lib/format";
import { useScrollToError } from "~/lib/scroll-to-error";
import { COMPETENCES, PHASES, type Assessment, type Competence, type Phase } from "./shared";
export type GradeDraft = {
  competence: Competence;
  phase: Phase;
  score: string;
  date: string;
  reason: string;
  notes: string;
};
type GradeField = "score" | "date" | "reason" | "notes";
type SaveMutation = ReturnType<typeof trpc.assessments.save.useMutation>;
type DraftSetters = {
  setGrades: Dispatch<SetStateAction<GradeDraft[]>>;
  setVersion: Dispatch<SetStateAction<number>>;
  setReason: Dispatch<SetStateAction<string>>;
  setErrors: Dispatch<SetStateAction<Record<string, string>>>;
};
export type AssessmentFormState = {
  grades: GradeDraft[];
  reason: string;
  setReason: DraftSetters["setReason"];
  errors: Record<string, string>;
  body: ReturnType<typeof useScrollToError>;
  save: SaveMutation;
  change: (index: number, values: { field: GradeField; value: string }) => void;
  submit: (event: FormEvent) => Promise<GradeDraft[] | null>;
};
function initialGrades(data: Assessment): GradeDraft[] {
  return PHASES.flatMap((phase) =>
    COMPETENCES.map((competence) => {
      const grade = data.grades.find((row) => row.phase === phase && row.competence === competence);
      return {
        phase,
        competence,
        score: grade ? String(grade.score).replace(".", ",") : "",
        date: formatDateOnlyBR(grade?.assessedOn ?? data.today),
        reason: grade?.reason ?? "",
        notes:
          data.observations?.find((row) => row.phase === phase && row.competence === competence)
            ?.notes ?? "",
      };
    }),
  );
}
export function useAssessmentForm(data: Assessment): AssessmentFormState {
  const [grades, setGrades] = useState(() => initialGrades(data));
  const [version, setVersion] = useState(data.version);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);
  const body = useScrollToError(revision);
  const save = useAssessmentSave({ setGrades, setVersion, setReason, setErrors });
  return {
    grades,
    reason,
    setReason,
    errors,
    body,
    save,
    change: gradeChangeHandler({ setGrades, setErrors, save }),
    submit: gradeSubmitHandler({ data, grades, version, reason, save, setErrors, setRevision }),
  };
}
function useAssessmentSave(setters: DraftSetters): SaveMutation {
  const utils = trpc.useUtils();
  return trpc.assessments.save.useMutation({
    onSuccess: async (saved) => {
      setters.setGrades(initialGrades(saved));
      setters.setVersion(saved.version);
      setters.setReason("");
      setters.setErrors({});
      // Includes the teacher workspace as soon as its routes are present in this block.
      await utils.invalidate();
    },
  });
}
function gradeChangeHandler({
  setGrades,
  setErrors,
  save,
}: Pick<DraftSetters, "setGrades" | "setErrors"> & {
  save: SaveMutation;
}): AssessmentFormState["change"] {
  return (index, { field, value }) => {
    setGrades((current) =>
      current.map((grade, position) => (position === index ? { ...grade, [field]: value } : grade)),
    );
    setErrors((current) => ({
      ...current,
      [`grades.${index}.${field === "date" ? "assessedOn" : field}`]: "",
      ...(field === "score" && !value.trim()
        ? { [`grades.${index}.assessedOn`]: "", [`grades.${index}.reason`]: "" }
        : {}),
    }));
    save.reset();
  };
}
type SubmitValues = Pick<AssessmentFormState, "grades" | "reason" | "save"> & {
  data: Assessment;
  version: number;
  setErrors: DraftSetters["setErrors"];
  setRevision: Dispatch<SetStateAction<number>>;
};
function gradeSubmitHandler(state: SubmitValues): AssessmentFormState["submit"] {
  return async (event) => {
    event.preventDefault();
    if (state.save.isPending) return null;
    const parsed = assessmentSaveSchema.safeParse({
      progressId: state.data.progressId,
      version: state.version,
      correctionReason: state.reason,
      grades: state.grades.map((grade) => ({
        phase: grade.phase,
        competence: grade.competence,
        score: grade.score.trim() === "" ? null : Number(grade.score.replace(",", ".")),
        assessedOn: grade.score.trim() === "" ? null : (parseDateBR(grade.date) ?? ""),
        reason: grade.reason || null,
        notes: grade.notes || null,
      })),
    });
    if (!parsed.success) {
      state.setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
        ),
      );
      state.setRevision((value) => value + 1);
      return null;
    }
    try {
      const saved = await state.save.mutateAsync(parsed.data);
      return initialGrades(saved);
    } catch {
      return null;
    }
  };
}
