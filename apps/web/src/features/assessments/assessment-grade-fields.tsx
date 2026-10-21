import type { ReactElement } from "react";
import { Field, FieldError, Input, Label } from "@lazuli/ui";
import { maskDateBR } from "~/lib/masks";
import { COMPETENCE_LABELS } from "./shared";
import type { GradeDraft } from "./use-assessment-form";
type Props = {
  id: string;
  grade: GradeDraft;
  index: number;
  errors: Record<string, string>;
  disabled?: boolean;
  className?: string | undefined;
  onChange: (field: "score" | "date" | "reason", value: string) => void;
};
export function AssessmentGradeFields(props: Props): ReactElement {
  return (
    <>
      <div className={props.className}>
        <GradeScoreField {...props} />
        <GradeDateField {...props} />
      </div>
      {props.grade.phase === "RECOVERY" && <GradeRecoveryField {...props} />}
    </>
  );
}
function GradeScoreField({ id, grade, index, errors, disabled, onChange }: Props): ReactElement {
  return (
    <Field>
      <Label htmlFor={`${id}-score`}>Nota</Label>
      <Input
        id={`${id}-score`}
        name={`score-${index}`}
        aria-label={`Nota de ${COMPETENCE_LABELS[grade.competence]}`}
        size="dense"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0–100"
        value={grade.score}
        disabled={disabled}
        invalid={Boolean(errors[`grades.${index}.score`])}
        onChange={(event) => onChange("score", event.target.value)}
      />
      <FieldError match={Boolean(errors[`grades.${index}.score`])}>
        {errors[`grades.${index}.score`]}
      </FieldError>
    </Field>
  );
}
function GradeDateField({ id, grade, index, errors, disabled, onChange }: Props): ReactElement {
  return (
    <Field>
      <Label htmlFor={`${id}-date`}>Data da avaliação</Label>
      <Input
        id={`${id}-date`}
        name={`date-${index}`}
        aria-label={`Data da avaliação de ${COMPETENCE_LABELS[grade.competence]}`}
        size="dense"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        value={grade.date}
        disabled={disabled}
        invalid={Boolean(errors[`grades.${index}.assessedOn`])}
        onChange={(event) => onChange("date", maskDateBR(event.target.value))}
      />
      <FieldError match={Boolean(errors[`grades.${index}.assessedOn`])}>
        {errors[`grades.${index}.assessedOn`]}
      </FieldError>
    </Field>
  );
}
function GradeRecoveryField({ id, grade, index, errors, disabled, onChange }: Props): ReactElement {
  return (
    <Field>
      <Label htmlFor={`${id}-reason`}>Recuperação realizada</Label>
      <Input
        id={`${id}-reason`}
        name={`reason-${index}`}
        size="dense"
        value={grade.reason}
        disabled={disabled}
        placeholder="Ex.: revisão orientada e nova prova"
        invalid={Boolean(errors[`grades.${index}.reason`])}
        onChange={(event) => onChange("reason", event.target.value)}
      />
      <FieldError match={Boolean(errors[`grades.${index}.reason`])}>
        {errors[`grades.${index}.reason`]}
      </FieldError>
    </Field>
  );
}
