import type { JSX as ReactJSX } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Badge, Field, Label, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";

const WEEKDAY_LABEL_LENGTH = 3;

const ISO_DATE_LENGTH = 10;

export type OrganizationBoard = RouterOutputs["semesterOrganization"]["detail"];
export type ClassPlan = OrganizationBoard["plans"][number];
export type Placement = OrganizationBoard["placements"][number];
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
    .map(
      (slot) =>
        `${weekdays[slot.weekday].slice(0, WEEKDAY_LABEL_LENGTH)} ${slot.startTime}–${slot.endTime}`,
    )
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
      utils.dashboard.invalidate(),
    ]);
  };
}
export function PlacementBadge({ row }: { row: Placement }): ReactJSX.Element {
  const blocked = row.blockers.length > 0;
  if (row.publishedAt) {
    let label = "Publicada";
    if (row.entryStatus === "APPLIED") label = "Efetivada";
    else if (blocked) label = "Revisar publicação";
    return <Badge variant={blocked ? "warning" : "success"}>{label}</Badge>;
  }
  return (
    <Badge variant={blocked ? "neutral" : "info"}>
      {blocked ? "Pendente" : "Pronta para publicar"}
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
