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

/** e.g. "16 alunos · 6 turmas ativas" — the header line under the title. */
export function headerSummaryVm(
  output: Pick<StudentListOutput, "totalStudents" | "activeClasses">,
): string {
  const students = output.totalStudents === 1 ? "1 aluno" : `${output.totalStudents} alunos`;
  const classes =
    output.activeClasses === 1 ? "1 turma ativa" : `${output.activeClasses} turmas ativas`;

  return `${students} · ${classes}`;
}

export const STATUS_TAB_VALUES = ["todos", "ativos", "inativos"] as const;

export type StatusTabValue = (typeof STATUS_TAB_VALUES)[number];

export type StatusTabVm = { value: StatusTabValue; label: string; count: number };

export function statusTabsVm(counts: StudentListOutput["counts"]): StatusTabVm[] {
  return [
    { value: "todos", label: "Todos", count: counts.all },
    { value: "ativos", label: "Ativos", count: counts.active },
    { value: "inativos", label: "Inativos", count: counts.inactive },
  ];
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
