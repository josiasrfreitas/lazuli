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
export function useAssessmentForm(data: Assessment) {
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
  function change(
    index: number,
    field: "score" | "date" | "reason" | "notes",
    value: string,
  ): void {
    setGrades((current) =>
      current.map((grade, position) => (position === index ? { ...grade, [field]: value } : grade)),
    );
    setErrors((current) => ({
      ...current,
      [`grades.${index}.${field === "date" ? "assessedOn" : field}`]: "",
      ...(field === "score" && !value.trim()
        ? {
            [`grades.${index}.assessedOn`]: "",
            [`grades.${index}.reason`]: "",
          }
        : {}),
    }));
    save.reset();
  }
  async function submit(event: FormEvent): Promise<GradeDraft[] | null> {
    event.preventDefault();
    if (save.isPending) return null;
    const parsed = assessmentSaveSchema.safeParse({
      progressId: data.progressId,
      version,
      correctionReason: reason,
      grades: grades.map((grade) => ({
        phase: grade.phase,
        competence: grade.competence,
        score: grade.score.trim() === "" ? null : Number(grade.score.replace(",", ".")),
        assessedOn: grade.score.trim() === "" ? null : (parseDateBR(grade.date) ?? ""),
        reason: grade.reason || null,
        notes: grade.notes || null,
      })),
    });
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
