import { BriefcaseBusiness, CalendarDays } from "lucide-react";
import type { ReactElement } from "react";
import {
  Field,
  FieldError,
  FormRow,
  FormSection,
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
  Textarea,
} from "@lazuli/ui";
import { maskDateBR } from "~/lib/masks";
import styles from "./teacher-form.module.css";
import type { TeacherDraft, TeacherFieldProps } from "./teacher-form";

export const EMPLOYMENT_LABELS = {
  CLT: "CLT",
  PJ: "Pessoa jurídica",
  AUTONOMOUS: "Autônomo",
  OTHER: "Outro",
};
export function TeacherEmploymentFields({
  draft,
  errors,
  change,
}: TeacherFieldProps): ReactElement {
  return (
    <FormSection
      title={
        <span className="flex items-center gap-2">
          <BriefcaseBusiness className="size-4" aria-hidden="true" />
          Contratação
        </span>
      }
    >
      <div className={styles.contractRow}>
        <Field>
          <Label id="teacher-employment-label">Tipo de vínculo</Label>
          <SegmentedControl
            size="sm"
            wrap
            aria-labelledby="teacher-employment-label"
            value={draft.employmentType}
            invalid={Boolean(errors.employmentType)}
            onValueChange={(value) =>
              change("employmentType", value as TeacherDraft["employmentType"])
            }
          >
            {Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => (
              <SegmentedControlItem key={value} value={value}>
                {label}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
          {errors.employmentType && <FieldError match>{errors.employmentType}</FieldError>}
        </Field>
      </div>
      {draft.employmentType === "CLT" && (
        <FormSection
          title={
            <span className="flex items-center gap-2">
              <CalendarDays className="size-4" aria-hidden="true" />
              Previsão de férias
            </span>
          }
          description="Opcional. O período informado não altera a agenda de aulas."
        >
          <FormRow columns={2}>
            {(
              [
                ["vacationStart", "Início"],
                ["vacationEnd", "Fim"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key}>
                <Label htmlFor={`teacher-${key}`}>{label}</Label>
                <Input
                  id={`teacher-${key}`}
                  name={key}
                  size="compact-responsive"
                  autoComplete="off"
                  placeholder="dd/mm/aaaa"
                  inputMode="numeric"
                  value={draft[key]}
                  invalid={Boolean(errors[key])}
                  onChange={(event) => change(key, maskDateBR(event.target.value))}
                />
                {errors[key] && <FieldError match>{errors[key]}</FieldError>}
              </Field>
            ))}
          </FormRow>
        </FormSection>
      )}
      <Field>
        <Label htmlFor="teacher-notes">Observações</Label>
        <Textarea
          size="sm"
          invalid={Boolean(errors.notes)}
          id="teacher-notes"
          name="notes"
          autoComplete="off"
          placeholder="Informações adicionais sobre o professor"
          rows={2}
          maxLength={5000}
          value={draft.notes}
          onChange={(event) => change("notes", event.target.value)}
        />
        {errors.notes && <FieldError match>{errors.notes}</FieldError>}
      </Field>
    </FormSection>
  );
}
