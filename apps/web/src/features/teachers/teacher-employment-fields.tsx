import { BriefcaseBusiness, CalendarDays } from "lucide-react";
import { useState, type ReactElement } from "react";
import { DEFAULT_TEACHING_MODALITY, TEACHING_HOUR_MINUTES } from "@lazuli/domain";
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
  const [classCount, setClassCount] = useState("");
  const hoursPerClass = DEFAULT_TEACHING_MODALITY.weeklyMinutes / TEACHING_HOUR_MINUTES;
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
        <Field>
          <Label htmlFor="teacher-class-count">Quantidade de turmas</Label>
          <Input
            id="teacher-class-count"
            size="compact-responsive"
            autoComplete="off"
            placeholder="Ex.: 3"
            inputMode="numeric"
            value={classCount}
            aria-describedby="teacher-workload-hint"
            onChange={(event) => {
              const value = event.target.value;
              if (!/^\d*$/.test(value)) return;
              setClassCount(value);
              if (value) change("weeklyHours", String(Number(value) * hoursPerClass));
            }}
          />
        </Field>
        <Field>
          <Label htmlFor="teacher-weekly-hours">Horas-aula por semana</Label>
          <Input
            id="teacher-weekly-hours"
            name="weeklyHours"
            size="compact-responsive"
            autoComplete="off"
            placeholder="Ex.: 20"
            inputMode="decimal"
            value={draft.weeklyHours}
            invalid={Boolean(errors.weeklyHours)}
            onChange={(event) => {
              setClassCount("");
              change("weeklyHours", event.target.value);
            }}
          />
          {errors.weeklyHours && <FieldError match>{errors.weeklyHours}</FieldError>}
        </Field>
      </div>
      <p id="teacher-workload-hint" className="text-caption text-muted-foreground">
        Cada turma equivale a {hoursPerClass} horas-aula por semana. Use para calcular ou ajuste as
        horas diretamente.
      </p>
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
