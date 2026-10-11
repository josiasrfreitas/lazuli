import { useState, type FormEvent } from "react";
import { assessmentSaveSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { parseDateBR } from "~/lib/masks";
import { formatDateOnlyBR } from "~/lib/format";
import { useScrollToError } from "~/lib/scroll-to-error";
import { COMPETENCES, PHASES, type Assessment, type Phase } from "./shared";
import type { GradeDraft } from "./grade-fields";

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
      };
    }),
  );
}
export function useAssessmentForm(data: Assessment, onClose: () => void) {
  const [grades, setGrades] = useState(() => initialGrades(data));
  const [phase, setPhase] = useState<Phase>("BLOCK_ONE");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);
  const body = useScrollToError(revision);
  const utils = trpc.useUtils();
  const save = trpc.assessments.save.useMutation({
    onSuccess: async () => {
      await utils.assessments.invalidate();
      onClose();
    },
  });
  function change(index: number, field: "score" | "date" | "reason", value: string): void {
    setGrades((current) =>
      current.map((grade, position) => (position === index ? { ...grade, [field]: value } : grade)),
    );
    setErrors((current) => ({
      ...current,
      [`grades.${index}.${field === "date" ? "assessedOn" : field}`]: "",
    }));
    save.reset();
  }
  function submit(event: FormEvent): void {
    event.preventDefault();
    if (save.isPending) return;
    const parsed = assessmentSaveSchema.safeParse({
      progressId: data.progressId,
      version: data.version,
      correctionReason: reason,
      grades: grades.map((grade) => ({
        phase: grade.phase,
        competence: grade.competence,
        score: grade.score.trim() === "" ? null : Number(grade.score.replace(",", ".")),
        assessedOn: grade.score.trim() === "" ? null : (parseDateBR(grade.date) ?? ""),
        reason: grade.reason || null,
      })),
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
        ),
      );
      const index = parsed.error.issues.find((issue) => issue.path[0] === "grades")?.path[1];
      if (typeof index === "number" && grades[index]) setPhase(grades[index].phase);
      setRevision((value) => value + 1);
      return;
    }
    save.mutate(parsed.data);
  }
  return { grades, phase, setPhase, reason, setReason, errors, body, save, change, submit };
}
