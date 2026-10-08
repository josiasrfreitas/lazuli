"use client";
import type { ReactElement } from "react";
import { Button, Input, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { ClassListParams as Params } from "./class-list-model";
export function ClassFilters({
  params,
  change,
  create,
}: {
  params: Params;
  change: (value: Partial<Params>) => void;
  create: () => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label="Buscar turmas"
        autoComplete="off"
        name="busca"
        placeholder="Código ou nome da turma"
        size="sm"
        value={params.busca}
        onChange={(event) => change({ busca: event.target.value, pagina: 1 })}
      />
      <SegmentedControl
        aria-label="Organização da turma"
        size="sm"
        value={params.tipo}
        onValueChange={(value) => change({ tipo: value, pagina: 1 })}
      >
        <SegmentedControlItem value="REGULAR">Regular</SegmentedControlItem>
        <SegmentedControlItem value="PERSONALIZED">PPT</SegmentedControlItem>
      </SegmentedControl>
      <AdvancedFilters params={params} change={change} />
      <Button onClick={create}>Nova turma</Button>
    </div>
  );
}
function FilterSelect({
  label,
  value,
  choices,
  change,
}: {
  label: string;
  value: string | null;
  choices: { value: string; label: string }[];
  change: (value: string | null) => void;
}): ReactElement {
  return (
    <select
      aria-label={label}
      className="h-control-sm rounded-sm border border-input bg-background px-2 text-control"
      value={value ?? ""}
      onChange={(event) => change(event.target.value || null)}
    >
      <option value="">{label}</option>
      {choices.map((choice) => (
        <option key={choice.value} value={choice.value}>
          {choice.label}
        </option>
      ))}
    </select>
  );
}
const FORMAT_CHOICES = [
  { value: "IN_PERSON", label: "Presencial" },
  { value: "ONLINE", label: "Online" },
];
const STATUS_CHOICES = [
  { value: "ACTIVE", label: "Ativa" },
  { value: "ARCHIVED", label: "Arquivada" },
];
function AdvancedFilters({
  params,
  change,
}: {
  params: Params;
  change: (value: Partial<Params>) => void;
}): ReactElement {
  const options = trpc.classes.formOptions.useQuery();
  return (
    <>
      <FilterSelect
        label="Formato"
        value={params.formato}
        choices={FORMAT_CHOICES}
        change={(formato) => change({ formato, pagina: 1 })}
      />
      <FilterSelect
        label="Professor"
        value={params.professor}
        choices={
          options.data?.teachers.map((teacher) => ({ value: teacher.id, label: teacher.name })) ??
          []
        }
        change={(professor) => change({ professor, pagina: 1 })}
      />
      <FilterSelect
        label="Semestre"
        value={params.semestre}
        choices={
          options.data?.semesters.map((semester) => ({
            value: semester.id,
            label: semester.name,
          })) ?? []
        }
        change={(semestre) => change({ semestre, pagina: 1 })}
      />
      <FilterSelect
        label="Estado"
        value={params.estado}
        choices={STATUS_CHOICES}
        change={(estado) => change({ estado, pagina: 1 })}
      />
    </>
  );
}
