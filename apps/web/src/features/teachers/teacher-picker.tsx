"use client";
import { type ReactElement, useState } from "react";
import { Field, FieldError, Label, SearchSelect, type SearchSelectOption } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";

export function TeacherPicker({
  date,
  value,
  onChange,
  error,
  disabled = false,
}: TeacherPickerInput): ReactElement {
  const [search, setSearch] = useState("");
  const query = trpc.teachers.options.useQuery({ date, search });
  return (
    <Field>
      <Label>Professor</Label>
      <SearchSelect
        size="compact-responsive"
        name="teacherId"
        placeholder="Buscar professor por nome"
        query={search}
        value={value}
        options={(query.data ?? []).map((teacher) => ({ id: teacher.id, label: teacher.name }))}
        loading={query.isFetching}
        failed={query.isError}
        invalid={Boolean(error)}
        disabled={disabled}
        onQueryChange={setSearch}
        onSelect={onChange}
        onClear={() => onChange(null)}
      />
      {error && <FieldError match>{error}</FieldError>}
    </Field>
  );
}

type TeacherPickerInput = {
  date: string;
  value: SearchSelectOption | null;
  onChange: (value: SearchSelectOption | null) => void;
  error?: string | null;
  disabled?: boolean;
};
