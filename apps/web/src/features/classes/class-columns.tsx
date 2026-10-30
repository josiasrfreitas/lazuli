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
  code: "wide",
  teacher: "standard",
  schedule: "standard",
  occupancy: "narrow",
} as const satisfies Record<string, NonNullable<DataTableColumn<ClassRow>["width"]>>;
const WIDE_STAGE_LENGTH = 24;
const MEDIUM_STAGE_LENGTH = 16;

export function classColumns(
  params: ClassListParams,
  rows: readonly ClassRow[] = [],
): readonly DataTableColumn<ClassRow>[] {
  const back = classListReturnUrl(params);
  const longestStage = Math.max(
    0,
    ...rows.map((row) => (row.sharedStage?.name ?? "Individual").length),
  );
  const stageWidth = classStageWidth(longestStage);
  return [
    {
      id: "code",
      header: "Turma",
      width: COLUMN_WIDTHS.code,
      cell: (row: ClassRow) => <ClassCodeLink row={row} back={back} />,
    },
    {
      id: "type",
      header: "Modalidade",
      cell: scheduleTypeCell,
    },
    { id: "format", header: "Formato", cell: (row: ClassRow) => formatFormat(row.format) },
    {
      id: "teacher",
      header: "Professor",
      width: COLUMN_WIDTHS.teacher,
      cell: (row: ClassRow) => row.currentTeacher?.name ?? "Sem professor",
    },
    {
      id: "stage",
      header: "Estágio",
      width: stageWidth,
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

function classStageWidth(length: number): "wide" | "medium" | "standard" {
  if (length > WIDE_STAGE_LENGTH) return "wide";
  return length > MEDIUM_STAGE_LENGTH ? "medium" : "standard";
}

function ClassCodeLink({ row, back }: { row: ClassRow; back: string }): ReactElement {
  return (
    <Link
      className="whitespace-nowrap font-medium text-primary underline-offset-2 hover:underline focus-visible:shadow-focus"
      href={`/turmas/${row.id}?voltar=${encodeURIComponent(back)}`}
    >
      {row.portalClassName}
    </Link>
  );
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

function occupancyCell({ occupancy }: ClassRow): ReactElement {
  const indicator = classOccupancyIndicator(occupancy);
  const detail = `${indicator.label}. 25 alunos é a referência global e não bloqueia matrículas.`;
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
