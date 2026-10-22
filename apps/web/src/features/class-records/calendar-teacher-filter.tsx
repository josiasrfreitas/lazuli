"use client";

import type { JSX as ReactJSX } from "react";
import { X } from "lucide-react";
import { normalizeSearch } from "@lazuli/domain";
import { Button, Field, Label, SearchSelect, type SearchSelectOption } from "@lazuli/ui";
import type { CalendarLesson } from "./calendar-model";

export function CalendarTeacherFilter({
  lessons,
  selected,
  query,
  onQueryChange,
  onChange,
}: {
  lessons: CalendarLesson[];
  selected: SearchSelectOption[];
  query: string;
  onQueryChange: (query: string) => void;
  onChange: (teachers: SearchSelectOption[]) => void;
}): ReactJSX.Element {
  const options = availableTeachers({ lessons, selected, query });

  return (
    <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
      <div className="w-full sm:w-56">
        <Field name="agendaTeacher">
          <Label className="sr-only">Filtrar por professor</Label>
          <SearchSelect
            name="agendaTeacher"
            placeholder="Buscar professor…"
            showSearchIcon
            openOnFocus
            value={null}
            query={query}
            options={options}
            onQueryChange={onQueryChange}
            onSelect={(teacher) => {
              if (!selected.some((item) => item.id === teacher.id)) {
                onChange([...selected, teacher]);
              }
              onQueryChange("");
            }}
            onClear={() => onQueryChange("")}
            emptyMessage="Nenhum outro professor encontrado."
          />
        </Field>
      </div>
      <SelectedTeachers selected={selected} onChange={onChange} />
    </div>
  );
}

function availableTeachers({
  lessons,
  selected,
  query,
}: {
  lessons: CalendarLesson[];
  selected: SearchSelectOption[];
  query: string;
}): SearchSelectOption[] {
  const search = normalizeSearch(query);
  return [
    ...new Map(
      lessons.map((lesson) => {
        const id = lesson.teacherId ?? "unassigned";
        return [id, { id, label: lesson.teacher ?? "Professor a definir" }] as const;
      }),
    ).values(),
  ]
    .filter(
      (teacher) =>
        !selected.some((item) => item.id === teacher.id) &&
        normalizeSearch(teacher.label).includes(search),
    )
    .toSorted((left, right) => left.label.localeCompare(right.label, "pt-BR"));
}

function SelectedTeachers({
  selected,
  onChange,
}: {
  selected: SearchSelectOption[];
  onChange: (teachers: SearchSelectOption[]) => void;
}): ReactJSX.Element | null {
  if (selected.length === 0) return null;
  return (
    <div
      className="flex min-w-0 flex-wrap gap-1"
      role="group"
      aria-label="Professores selecionados"
    >
      {selected.map((teacher) => (
        <Button
          key={teacher.id}
          variant="secondary"
          size="sm"
          aria-label={`Remover filtro de ${teacher.label}`}
          onClick={() => onChange(selected.filter((item) => item.id !== teacher.id))}
        >
          {teacher.label}
          <X aria-hidden="true" />
        </Button>
      ))}
    </div>
  );
}
