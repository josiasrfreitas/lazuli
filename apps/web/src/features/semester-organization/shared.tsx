import type { JSX as ReactJSX } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Badge, Field, Label, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";

const ISO_DATE_LENGTH = 10;

export type SemesterBoard = RouterOutputs["semesterOrganization"]["detail"];
export type ClassPlan = SemesterBoard["plans"][number];
export type Placement = SemesterBoard["placements"][number];
export type StudentContext = RouterOutputs["semesterOrganization"]["student"];
export const modes = {
  ENTRY: "Nova entrada",
  CONTINUE: "Manter estágio",
  ADVANCE: "Avançar estágio",
  REPEAT: "Repetir estágio",
} as const;
export const weekdays = {
  MONDAY: "Segunda",
  TUESDAY: "Terça",
  WEDNESDAY: "Quarta",
  THURSDAY: "Quinta",
  FRIDAY: "Sexta",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
} as const;
export const dateOnly = (date: Date | string): string =>
  typeof date === "string"
    ? date.slice(0, ISO_DATE_LENGTH)
    : date.toISOString().slice(0, ISO_DATE_LENGTH);
export function scheduleLabel(slots: ClassPlan["slots"]): string {
  return slots
    .map((slot) => `${weekdays[slot.weekday].slice(0, 3)} ${slot.startTime}–${slot.endTime}`)
    .join(" · ");
}
export function useOrganizationRefresh() {
  const utils = trpc.useUtils();
  return async () => {
    await Promise.all([
      utils.semesterOrganization.invalidate(),
      utils.classes.invalidate(),
      utils.enrollment.invalidate(),
      utils.students.invalidate(),
      utils.admissions.invalidate(),
      utils.activity.invalidate(),
    ]);
  };
}
export function PlacementBadge({ row }: { row: Placement }): ReactJSX.Element {
  return (
    <Badge
      variant={
        row.publishedAt
          ? row.blockers.length > 0
            ? "warning"
            : "success"
          : row.blockers.length > 0
            ? "neutral"
            : "info"
      }
    >
      {row.publishedAt
        ? row.entryStatus === "APPLIED"
          ? "Efetivada"
          : row.blockers.length > 0
            ? "Revisar publicação"
            : "Publicada"
        : row.blockers.length > 0
          ? "Pendente"
          : "Pronta para publicar"}
    </Badge>
  );
}
export function Choices({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
}): ReactJSX.Element {
  return (
    <Field>
      <Label id={`${name}-label`}>{label}</Label>
      <SegmentedControl
        size="sm"
        wrap
        value={value}
        aria-labelledby={`${name}-label`}
        onValueChange={(next) => {
          if (next) onChange(next);
        }}
      >
        {Object.entries(options).map(([key, text], index) => (
          <SegmentedControlItem key={key} id={index === 0 ? name : undefined} value={key}>
            {text}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </Field>
  );
}
