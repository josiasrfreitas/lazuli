import type { RouterOutputs } from "@lazuli/api";

export type TeacherMetricClass = RouterOutputs["teachers"]["metrics"]["classes"][number];
export const CLASS_ORDERS = ["score", "grades", "absence"] as const;
export type TeacherClassOrder = (typeof CLASS_ORDERS)[number];
export const CLASS_DIRECTIONS = ["asc", "desc"] as const;
export type TeacherClassDirection = (typeof CLASS_DIRECTIONS)[number];
export const CLASS_TYPES = ["REGULAR", "PERSONALIZED"] as const;
export type TeacherClassFilters = {
  type: (typeof CLASS_TYPES)[number] | null;
  attention: boolean;
};
export const CLASS_TYPE_OPTIONS = [
  { value: "REGULAR", label: "Regular" },
  { value: "PERSONALIZED", label: "PPT" },
] as const;
export const CLASS_ORDER_OPTIONS = [
  { value: "score", label: "Score" },
  { value: "grades", label: "Notas" },
  { value: "absence", label: "Faltas" },
] as const;

export function defaultClassDirection(order: TeacherClassOrder): TeacherClassDirection {
  return order === "absence" ? "desc" : "asc";
}

export function filterTeacherClasses(
  rows: readonly TeacherMetricClass[],
  {
    students,
    filters,
  }: { students: readonly { id: string; level: string }[]; filters: TeacherClassFilters },
): TeacherMetricClass[] {
  const attentionIds = new Set(
    students
      .filter((student) => student.level === "ATTENTION" || student.level === "PRIORITY")
      .map((student) => student.id),
  );
  return rows.filter(
    (row) =>
      (!filters.type || row.scheduleType === filters.type) &&
      (!filters.attention || row.studentIds.some((id) => attentionIds.has(id))),
  );
}

/** Missing evidence always follows measured values, including a genuine zero. */
export function orderTeacherClasses(
  rows: readonly TeacherMetricClass[],
  {
    order,
    direction = defaultClassDirection(order),
  }: { order: TeacherClassOrder; direction?: TeacherClassDirection },
): TeacherMetricClass[] {
  return rows.toSorted((leftRow, rightRow) => {
    const byName = leftRow.name.localeCompare(rightRow.name, "pt-BR", { numeric: true });
    const left = order === "absence" ? leftRow.attendance.percent : leftRow[order];
    const right = order === "absence" ? rightRow.attendance.percent : rightRow[order];
    if (left === null) return right === null ? byName : 1;
    if (right === null) return -1;
    return (direction === "desc" ? right - left : left - right) || byName;
  });
}
