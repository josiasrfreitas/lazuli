import Link from "next/link";
import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Badge, Tooltip, TooltipTrigger, TooltipContent, type DataTableColumn } from "@lazuli/ui";
import {
  formatClassSchedule,
  formatClassScheduleTime,
  formatFormat,
  formatScheduleType,
} from "./labels";
import { classListReturnUrl, type ClassListParams } from "./class-list-model";

export type ClassRow = RouterOutputs["classes"]["list"]["rows"][number];
const COLUMN_WIDTHS = {
  code: "standard",
  teacher: "standard",
  schedule: "narrow",
  occupancy: "narrow",
} as const satisfies Record<string, NonNullable<DataTableColumn<ClassRow>["width"]>>;

export function classColumns(params: ClassListParams): readonly DataTableColumn<ClassRow>[] {
  const back = classListReturnUrl(params);
  return [
    {
      id: "code",
      header: "Turma",
      width: COLUMN_WIDTHS.code,
      cell: (row: ClassRow) => (
        <Link
          className="font-medium text-primary underline-offset-2 hover:underline focus-visible:shadow-focus"
          href={`/turmas/${row.id}?voltar=${encodeURIComponent(back)}`}
        >
          {row.internalCode}
        </Link>
      ),
    },
    {
      id: "type",
      header: "Organização",
      cell: (row: ClassRow) => formatScheduleType(row.scheduleType),
    },
    { id: "format", header: "Formato", cell: (row: ClassRow) => formatFormat(row.format) },
    {
      id: "teacher",
      header: "Professor",
      width: COLUMN_WIDTHS.teacher,
      cell: (row: ClassRow) => row.teacher.name,
    },
    {
      id: "stage",
      header: "Etapa",
      cell: (row: ClassRow) => row.sharedStage?.name ?? "Individual",
    },
    {
      id: "schedule",
      header: "Horários",
      width: COLUMN_WIDTHS.schedule,
      cell: scheduleCell,
    },
    {
      id: "occupancy",
      header: "Ocupação",
      width: COLUMN_WIDTHS.occupancy,
      numeric: true,
      cell: occupancyCell,
    },
  ];
}

function scheduleCell(row: ClassRow): ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span tabIndex={0} />}
        aria-label={formatClassScheduleTime(row.scheduleSlots)}
      >
        {formatClassSchedule(row.scheduleSlots)}
      </TooltipTrigger>
      <TooltipContent>{formatClassScheduleTime(row.scheduleSlots)}</TooltipContent>
    </Tooltip>
  );
}

function occupancyCell({ occupancy, capacity }: ClassRow): ReactElement {
  const remaining = capacity - occupancy;
  let detail = "Turma cheia";
  if (remaining > 0) detail = `${remaining} vagas livres`;
  if (remaining < 0) detail = `${-remaining} acima da capacidade`;
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span tabIndex={0} />}
        aria-label={`${occupancy} alunos, capacidade ${capacity}. ${detail}`}
      >
        <Badge variant={remaining > 0 ? "neutral" : "warning"}>
          <span className="font-numeric">
            {occupancy}
            <span className="font-normal">/{capacity}</span>
          </span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{detail}</TooltipContent>
    </Tooltip>
  );
}
