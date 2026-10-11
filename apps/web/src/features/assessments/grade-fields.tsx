"use client";
import type { ReactElement } from "react";
import { Field, FieldError, Input, Label } from "@lazuli/ui";
import { maskDateBR } from "~/lib/masks";
import { COMPETENCE_LABELS, type Competence, type Phase } from "./shared";
export type GradeDraft = {
  competence: Competence;
  phase: Phase;
  score: string;
  date: string;
  reason: string;
};
export type GradeFieldProps = {
  grade: GradeDraft;
  index: number;
  errors: Record<string, string>;
  onChange: (index: number, field: "score" | "date" | "reason", value: string) => void;
};
export function GradeFields(props: GradeFieldProps): ReactElement {
  const { grade, index, errors, onChange } = props;
  return (
    <div className="grid gap-3 border-b border-border pb-4 last:border-0 last:pb-0">
      <h3 className="text-caption font-semibold">{COMPETENCE_LABELS[grade.competence]}</h3>
      <div className="flex flex-wrap items-start gap-3">
        <Field className="w-24">
          <Label htmlFor={`grade-${index}`}>
            Nota<span className="sr-only"> de {COMPETENCE_LABELS[grade.competence]}</span>
          </Label>
          <Input
            id={`grade-${index}`}
            name={`grade-${index}`}
            aria-label={`Nota de ${COMPETENCE_LABELS[grade.competence]}`}
            size="sm"
            autoComplete="off"
            placeholder="0–100"
            inputMode="decimal"
            value={grade.score}
            invalid={Boolean(errors[`grades.${index}.score`])}
            onChange={(event) => onChange(index, "score", event.target.value)}
          />
          <FieldError match={Boolean(errors[`grades.${index}.score`])}>
            {errors[`grades.${index}.score`]}
          </FieldError>
        </Field>
        <Field className="w-40">
          <Label htmlFor={`date-${index}`}>
            Data da avaliação
            <span className="sr-only"> de {COMPETENCE_LABELS[grade.competence]}</span>
          </Label>
          <Input
            id={`date-${index}`}
            name={`date-${index}`}
            aria-label={`Data da avaliação de ${COMPETENCE_LABELS[grade.competence]}`}
            size="sm"
            autoComplete="off"
            placeholder="dd/mm/aaaa"
            inputMode="numeric"
            value={grade.date}
            invalid={Boolean(errors[`grades.${index}.assessedOn`])}
            onChange={(event) => onChange(index, "date", maskDateBR(event.target.value))}
          />
          <FieldError match={Boolean(errors[`grades.${index}.assessedOn`])}>
            {errors[`grades.${index}.assessedOn`]}
          </FieldError>
        </Field>
      </div>
      {grade.phase === "RECOVERY" && grade.score !== "" && <RecoveryReason {...props} />}
    </div>
  );
}
function RecoveryReason({ grade, index, errors, onChange }: GradeFieldProps): ReactElement {
  return (
    <Field>
      <Label htmlFor={`reason-${index}`}>
        Recuperação realizada
        <span className="sr-only"> de {COMPETENCE_LABELS[grade.competence]}</span>
      </Label>
      <Input
        id={`reason-${index}`}
        name={`reason-${index}`}
        size="sm"
        autoComplete="off"
        placeholder="Ex.: revisão orientada e nova atividade oral"
        value={grade.reason}
        invalid={Boolean(errors[`grades.${index}.reason`])}
        onChange={(event) => onChange(index, "reason", event.target.value)}
      />
      <FieldError match={Boolean(errors[`grades.${index}.reason`])}>
        {errors[`grades.${index}.reason`]}
      </FieldError>
    </Field>
  );
}
