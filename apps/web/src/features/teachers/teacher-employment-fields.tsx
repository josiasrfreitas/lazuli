import { BriefcaseBusiness } from "lucide-react";
import type { ReactElement } from "react";
import {
  Field,
  FieldError,
  Switch,
  FormSection,
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
  Textarea,
} from "@lazuli/ui";
import { SelectControl } from "../classes/form-controls";
import { AREA_LABELS } from "./employee-labels";
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
  existingTeacher = false,
}: TeacherFieldProps & { existingTeacher?: boolean }): ReactElement {
  return (
    <FormSection
      title={
        <span className="flex items-center gap-2">
          <BriefcaseBusiness className="size-4" aria-hidden="true" />
          Contratação
        </span>
      }
    >
      <AreaAndJobFields draft={draft} change={change} errors={errors} />
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
      <Field className="flex items-center gap-2">
        <Switch
          id="teaches"
          name="teaches"
          checked={draft.teaches}
          disabled={existingTeacher}
          onCheckedChange={(value) => change("teaches", value)}
        />
        <Label htmlFor="teaches">
          {existingTeacher ? "Perfil docente vinculado" : "Atua como docente"}
        </Label>
      </Field>
      {draft.teaches && (
        <Field>
          <Label htmlFor="teacher-notes">Observações</Label>
          <Textarea
            size="sm"
            invalid={Boolean(errors.notes)}
            id="teacher-notes"
            name="notes"
            autoComplete="off"
            placeholder="Informações adicionais sobre o docente"
            rows={2}
            maxLength={5000}
            value={draft.notes}
            onChange={(event) => change("notes", event.target.value)}
          />
          {errors.notes && <FieldError match>{errors.notes}</FieldError>}
        </Field>
      )}
    </FormSection>
  );
}

function AreaAndJobFields({ draft, change, errors }: TeacherFieldProps): ReactElement {
  return (
    <div className={styles.personalRow}>
      <SelectControl
        name="area"
        label="Área"
        choices={Object.entries(AREA_LABELS).map(([value, label]) => ({ value, label }))}
        value={draft.area ?? ""}
        error={errors.area}
        onChange={(value) => change("area", value as TeacherDraft["area"])}
      />
      <Field>
        <Label htmlFor="jobTitle">Cargo</Label>
        <Input
          id="jobTitle"
          name="jobTitle"
          size="compact-responsive"
          maxLength={120}
          placeholder="Ex.: Assistente de secretaria"
          autoComplete="off"
          value={draft.jobTitle}
          invalid={Boolean(errors.jobTitle)}
          onChange={(event) => change("jobTitle", event.target.value)}
        />
        {errors.jobTitle && <FieldError match>{errors.jobTitle}</FieldError>}
      </Field>
    </div>
  );
}
