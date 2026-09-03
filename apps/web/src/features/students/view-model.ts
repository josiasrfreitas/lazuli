import type { BadgeVariant } from "@lazuli/ui";
import type { StudentListOutput, StudentListRow } from "@lazuli/validators";

import { EM_DASH, formatAttendancePercent, formatBRLFromCents, toWhatsAppUrl } from "~/lib/format";

/**
 * Pure DTO → props mapping for the students listing. Everything here is
 * synchronous and side-effect free so the table components stay presentational
 * and these rules stay unit-testable without React.
 */

export type FactTone = "default" | "muted" | "success" | "destructive";

export type FactCellVm = {
  label: string;
  tone: FactTone;
  /** Whether the label is a number and should use the numeric font. */
  numeric: boolean;
};

export function attendanceCellVm(attendance: StudentListRow["attendance"]): FactCellVm {
  if (attendance.percent === null) {
    return { label: EM_DASH, tone: "muted", numeric: false };
  }

  return {
    label: formatAttendancePercent(attendance.percent),
    tone: attendance.flagged ? "destructive" : "default",
    numeric: true,
  };
}

export function financeCellVm(finance: StudentListRow["finance"]): FactCellVm {
  if (finance.kind === "none") {
    return { label: EM_DASH, tone: "muted", numeric: false };
  }

  if (finance.kind === "upToDate") {
    return { label: "Em dia", tone: "success", numeric: false };
  }

  return { label: formatBRLFromCents(finance.overdueCents), tone: "destructive", numeric: true };
}

export type WhatsAppVm = { url: string; label: string };

/** null when the student has no phone — the cell shows an em dash instead. */
export function whatsAppVm(row: Pick<StudentListRow, "fullName" | "phone">): WhatsAppVm | null {
  const url = toWhatsAppUrl(row.phone);

  return url === null ? null : { url, label: `Abrir WhatsApp de ${row.fullName}` };
}

export type HeaderSummaryVm = {
  activeClasses: number;
  totalStudents: number;
};

/** Keeps static summary copy renderable while its two counts are loading. */
export function headerSummaryVm(
  output?: Pick<StudentListOutput, "totalStudents" | "activeClasses">,
): HeaderSummaryVm | undefined {
  if (output === undefined) return undefined;

  return { activeClasses: output.activeClasses, totalStudents: output.totalStudents };
}

export const STATUS_TAB_VALUES = ["todos", "ativos", "inativos"] as const;

export type StatusTabValue = (typeof STATUS_TAB_VALUES)[number];

export type StatusTabVm = { value: StatusTabValue; label: string; count?: number };

/** Omitted counts (first load, error) render the tabs without numbers. */
export function statusTabsVm(counts?: StudentListOutput["counts"]): StatusTabVm[] {
  return [
    { value: "todos", label: "Todos", ...(counts === undefined ? {} : { count: counts.all }) },
    { value: "ativos", label: "Ativos", ...(counts === undefined ? {} : { count: counts.active }) },
    {
      value: "inativos",
      label: "Inativos",
      ...(counts === undefined ? {} : { count: counts.inactive }),
    },
  ];
}

export type StatusBadgeVm = { label: string; variant: BadgeVariant };

/**
 * Detailed status for the preview panel. The table groups these under the
 * Inativos tab; here each one reads by its own name (D-0024 vocabulary).
 * Only Trancado warns — Desistente and Inativo are records, not alerts.
 */
export function statusBadgeVm(status: StudentListRow["status"]): StatusBadgeVm {
  switch (status) {
    case "ACTIVE": {
      return { label: "Ativo", variant: "success" };
    }
    case "SUSPENDED": {
      return { label: "Trancado", variant: "warning" };
    }
    case "DROPPED": {
      return { label: "Desistente", variant: "neutral" };
    }
    case "INACTIVE": {
      return { label: "Inativo", variant: "neutral" };
    }
  }
}

export type StudentsTableState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "empty" }
  | { kind: "noResults" }
  | { kind: "data"; rows: StudentListRow[] };

/** Distinguishes "school has no students" from "these filters match nothing". */
export function tableStateVm(input: {
  rows: StudentListRow[] | undefined;
  isError: boolean;
  filtered: boolean;
}): StudentsTableState {
  if (input.isError) {
    return { kind: "error" };
  }

  if (input.rows === undefined) {
    return { kind: "loading" };
  }

  if (input.rows.length === 0) {
    return input.filtered ? { kind: "noResults" } : { kind: "empty" };
  }

  return { kind: "data", rows: input.rows };
}
