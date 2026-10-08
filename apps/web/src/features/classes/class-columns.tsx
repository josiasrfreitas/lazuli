import Link from "next/link";
import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Badge, Tooltip, TooltipTrigger, TooltipContent, type DataTableColumn } from "@lazuli/ui";
import {
  classOccupancyIndicator,
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
  stage: "wide",
  schedule: "medium",
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
      cell: scheduleTypeCell,
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
      width: COLUMN_WIDTHS.stage,
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
  const indicator = classOccupancyIndicator(occupancy, capacity);
  const detail = `${indicator.label}. A capacidade é uma referência e não bloqueia matrículas.`;
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} />} aria-label={`${occupancy} alunos. ${detail}`}>
        <Badge variant={indicator.variant}>
          <span className="font-numeric">{occupancy}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{detail}</TooltipContent>
    </Tooltip>
  );
}

function scheduleTypeCell(row: ClassRow): ReactElement {
  return (
    <Badge variant={row.scheduleType === "REGULAR" ? "info" : "neutral"}>
      {formatScheduleType(row.scheduleType)}
    </Badge>
  );
}
