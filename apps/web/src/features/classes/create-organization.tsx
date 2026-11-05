"use client";
import { normalizeSearch } from "@lazuli/domain";
import { useState, type ReactElement } from "react";
import {
  Field,
  FieldError,
  FormRow,
  Input,
  Label,
  SearchSelect,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import type { ClassFieldsProps } from "./create-fields";
import { SelectControl } from "./form-controls";
import { maskDateBR } from "~/lib/masks";

const REGULAR_COLUMNS = 3;

function TeacherAndFormat(props: ClassFieldsProps): ReactElement {
  const { draft, change } = props;
  return (
    <FormRow columns={2}>
      <TeacherSearch {...props} />
      <div className="grid min-w-0 grid-cols-2 gap-4">
        <Field>
          <Label>Tipo de turma</Label>
          <SegmentedControl
            aria-label="Tipo de turma"
            size="sm"
            value={draft.scheduleType}
            onValueChange={(value) => {
              if (value === "REGULAR" || value === "PERSONALIZED") change("scheduleType", value);
            }}
          >
            <SegmentedControlItem value="REGULAR">Regular</SegmentedControlItem>
            <SegmentedControlItem value="PERSONALIZED">PPT</SegmentedControlItem>
          </SegmentedControl>
        </Field>
        <Field>
          <Label>Formato</Label>
          <SegmentedControl
            aria-label="Formato"
            size="sm"
            value={draft.format}
            onValueChange={(value) => {
              if (value === "IN_PERSON" || value === "ONLINE") change("format", value);
            }}
          >
            <SegmentedControlItem value="IN_PERSON">Presencial</SegmentedControlItem>
            <SegmentedControlItem value="ONLINE">Online</SegmentedControlItem>
          </SegmentedControl>
        </Field>
      </div>
    </FormRow>
  );
}

function TeacherSearch({ draft, change, options, errors }: ClassFieldsProps): ReactElement {
  const [query, setQuery] = useState("");
  const selected = options.teachers.find((teacher) => teacher.id === draft.teacherId);
  const choices = options.teachers
    .filter((teacher) => normalizeSearch(teacher.name).includes(normalizeSearch(query)))
    .map((teacher) => ({ id: teacher.id, label: teacher.name }));
  return (
    <Field name="teacherId">
      <Label>Professor</Label>
      <SearchSelect
        name="teacherId"
        placeholder="Buscar professor"
        showSearchIcon
        query={query}
        value={selected ? { id: selected.id, label: selected.name } : null}
        options={choices}
        onQueryChange={setQuery}
        onSelect={(teacher) => {
          change("teacherId", teacher.id);
          setQuery("");
        }}
        onClear={() => {
          change("teacherId", "");
          setQuery("");
        }}
        invalid={Boolean(errors.teacherId)}
        openOnFocus
        emptyMessage="Nenhum professor encontrado."
      />
      <FieldError match={Boolean(errors.teacherId)}>{errors.teacherId}</FieldError>
    </Field>
  );
}

function SemesterAndStage(props: ClassFieldsProps): ReactElement {
  const { draft, change, options, errors } = props;
  const selectedPeriod = options.semesters.find((period) => period.id === draft.semesterId);
  return (
    <FormRow columns={draft.scheduleType === "REGULAR" ? REGULAR_COLUMNS : 2}>
      <SelectControl
        name="semesterId"
        label="Período"
        value={draft.semesterId}
        onChange={(value) => change("semesterId", value)}
        choices={options.semesters.map((item) => ({ value: item.id, label: item.name }))}
        error={errors.semesterId}
      />
      {draft.scheduleType === "REGULAR" && (
        <SelectControl
          name="sharedStageId"
          label="Estágio compartilhado"
          value={draft.sharedStageId}
          onChange={(value) => change("sharedStageId", value)}
          choices={options.stages.map((item) => ({
            value: item.id,
            label: `${item.internalCode} · ${item.name}`,
          }))}
          error={errors.sharedStageId}
        />
      )}
      <Field name="startDate">
        <Label htmlFor="startDate">Início das aulas</Label>
        <Input
          id="startDate"
          name="startDate"
          autoComplete="off"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          size="sm"
          value={draft.startDate}
          invalid={Boolean(errors.startDate)}
          onChange={(event) => change("startDate", maskDateBR(event.target.value))}
        />
        <FieldError match={Boolean(errors.startDate)}>{errors.startDate}</FieldError>
        {selectedPeriod && (
          <p className="text-caption text-muted-foreground">
            {selectedPeriod.startDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })} a{" "}
            {selectedPeriod.endDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
          </p>
        )}
      </Field>
    </FormRow>
  );
}

export function OrganizationFields(props: ClassFieldsProps): ReactElement {
  return (
    <>
      <TeacherAndFormat {...props} />
      <SemesterAndStage {...props} />
    </>
  );
}
