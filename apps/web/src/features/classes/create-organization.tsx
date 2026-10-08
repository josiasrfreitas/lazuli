"use client";
import type { ReactElement } from "react";
import { Field, FormRow, Label, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import type { ClassFieldsProps } from "./create-fields";
import { NativeSelect, TextControl } from "./form-controls";

function TypeAndFormat({
  draft,
  change,
}: Pick<ClassFieldsProps, "draft" | "change">): ReactElement {
  return (
    <FormRow columns={2}>
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
    </FormRow>
  );
}

function ClassCodes({
  draft,
  change,
  errors,
}: Pick<ClassFieldsProps, "draft" | "change" | "errors">): ReactElement {
  return (
    <FormRow columns={2}>
      <TextControl
        name="internalCode"
        label="Código interno"
        placeholder="Ex.: REG-2026-01"
        value={draft.internalCode}
        onChange={(value) => change("internalCode", value)}
        error={errors.internalCode}
      />
      {draft.scheduleType === "PERSONALIZED" && (
        <TextControl
          name="portalClassName"
          label="Nome no Portal"
          placeholder="Ex.: PPT Ana"
          value={draft.portalClassName}
          onChange={(value) => change("portalClassName", value)}
          error={errors.portalClassName}
        />
      )}
    </FormRow>
  );
}

function PeopleAndStage({
  draft,
  change,
  options,
}: Pick<ClassFieldsProps, "draft" | "change" | "options">): ReactElement {
  return (
    <>
      <FormRow columns={2}>
        <NativeSelect
          name="teacherId"
          label="Professor"
          value={draft.teacherId}
          onChange={(value) => change("teacherId", value)}
          choices={options.teachers.map((item) => ({ value: item.id, label: item.name }))}
        />
        <NativeSelect
          name="semesterId"
          label="Semestre"
          value={draft.semesterId}
          onChange={(value) => change("semesterId", value)}
          choices={options.semesters.map((item) => ({ value: item.id, label: item.name }))}
        />
      </FormRow>
      {draft.scheduleType === "REGULAR" && (
        <NativeSelect
          name="sharedStageId"
          label="Etapa compartilhada"
          value={draft.sharedStageId}
          onChange={(value) => change("sharedStageId", value)}
          choices={options.stages.map((item) => ({
            value: item.id,
            label: `${item.internalCode} · ${item.name}`,
          }))}
        />
      )}
    </>
  );
}

export function OrganizationFields(props: ClassFieldsProps): ReactElement {
  return (
    <>
      <TypeAndFormat {...props} />
      <ClassCodes {...props} />
      <PeopleAndStage {...props} />
    </>
  );
}
