"use client";
import type { ReactElement } from "react";
import { CircleCheck } from "lucide-react";
import { Input, TableFilters, TableFilterChips, type TableFilterField } from "@lazuli/ui";
import { classRosterInputSchema } from "@lazuli/validators";
import type { z } from "@lazuli/validators";

export type RosterSituation = z.infer<typeof classRosterInputSchema>["situations"][number];
const SITUATION_LABELS: Record<RosterSituation, string> = {
  CURRENT: "Vigente",
  SCHEDULED: "Programada",
  PAUSED: "Pausada",
  ENDED: "Encerrada",
};

export function RosterFilters({
  search,
  situations,
  changeSearch,
  changeSituations,
}: {
  search: string;
  situations: RosterSituation[];
  changeSearch: (value: string) => void;
  changeSituations: (value: RosterSituation[]) => void;
}): ReactElement {
  const fields: TableFilterField[] = [
    {
      id: "situations",
      label: "Situação",
      icon: CircleCheck,
      promoted: true,
      kind: "options",
      options: Object.entries(SITUATION_LABELS).map(([id, label]) => ({ id, label })),
      selected: situations,
      onChange: (values) => changeSituations(classRosterInputSchema.shape.situations.parse(values)),
      onClear: () => changeSituations([]),
    },
  ];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-64">
          <Input
            aria-label="Buscar aluno na turma"
            size="sm"
            placeholder="Buscar aluno"
            value={search}
            onChange={(event) => changeSearch(event.target.value)}
          />
        </div>
        <TableFilters fields={fields} onClearAll={() => changeSituations([])} />
      </div>
      <TableFilterChips fields={fields} />
    </div>
  );
}
