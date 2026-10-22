import { useState, type FormEvent } from "react";
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
type GradeChange = {
  index: number;
  field: "score" | "date" | "reason" | "notes";
  value: string;
};
type AssessmentFormState = {
  grades: GradeDraft[];
  reason: string;
  setReason: (reason: string) => void;
  errors: Record<string, string>;
  body: ReturnType<typeof useScrollToError>;
  save: ReturnType<typeof trpc.assessments.save.useMutation>;
  change: (update: GradeChange) => void;
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
function parseAssessmentSave(input: {
  data: Assessment;
  version: number;
  reason: string;
  grades: GradeDraft[];
}): ReturnType<typeof assessmentSaveSchema.safeParse> {
  return assessmentSaveSchema.safeParse({
    progressId: input.data.progressId,
    version: input.version,
    correctionReason: input.reason,
    grades: input.grades.map((grade) => ({
      phase: grade.phase,
      competence: grade.competence,
      score: grade.score.trim() === "" ? null : Number(grade.score.replace(",", ".")),
      assessedOn: grade.score.trim() === "" ? null : (parseDateBR(grade.date) ?? ""),
      reason: grade.reason || null,
      notes: grade.notes || null,
    })),
  });
}

function clearedGradeErrors(
  current: Record<string, string>,
  update: GradeChange,
): Record<string, string> {
  const { index, field, value } = update;
  return {
    ...current,
    [`grades.${index}.${field === "date" ? "assessedOn" : field}`]: "",
    ...(field === "score" && !value.trim()
      ? { [`grades.${index}.assessedOn`]: "", [`grades.${index}.reason`]: "" }
      : {}),
  };
}

export function useAssessmentForm(data: Assessment): AssessmentFormState {
  const [grades, setGrades] = useState(() => initialGrades(data));
  const [version, setVersion] = useState(data.version);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);
  const body = useScrollToError(revision);
  const utils = trpc.useUtils();
  const save = trpc.assessments.save.useMutation({
    onSuccess: async (saved) => {
      const next = initialGrades(saved);
      setGrades(next);
      setVersion(saved.version);
      setReason("");
      setErrors({});
      await Promise.all([utils.assessments.invalidate(), utils.teacherWorkspace.invalidate()]);
    },
  });
  function change(update: GradeChange): void {
    const { index, field, value } = update;
    setGrades((current) =>
      current.map((grade, position) => (position === index ? { ...grade, [field]: value } : grade)),
    );
    setErrors((current) => clearedGradeErrors(current, update));
    save.reset();
  }
  async function submit(event: FormEvent): Promise<GradeDraft[] | null> {
    event.preventDefault();
    if (save.isPending) return null;
    const parsed = parseAssessmentSave({ data, version, reason, grades });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
        ),
      );
      setRevision((value) => value + 1);
      return null;
    }
    try {
      const saved = await save.mutateAsync(parsed.data);
      return initialGrades(saved);
    } catch {
      return null;
    }
  }
  return { grades, reason, setReason, errors, body, save, change, submit };
}
