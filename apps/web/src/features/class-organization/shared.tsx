import type { JSX as ReactJSX } from "react";
import type { RouterOutputs } from "@lazuli/api";
import {
  Badge,
  Field,
  FieldError,
  Label,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
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
const shortWeekdays = new Map<string, string>(
  Object.entries(weekdays).map(([key, label]) => [key, label.slice(0, WEEKDAY_LABEL_LENGTH)]),
);

function shortWeekday(weekday: keyof typeof weekdays): string {
  return shortWeekdays.get(weekday) ?? weekday;
}

export function scheduleLabel(slots: ClassPlan["slots"]): string {
  return slots
    .map((slot) => `${shortWeekday(slot.weekday)} ${slot.startTime}–${slot.endTime}`)
    .join(" · ");
}
const dayList = new Intl.ListFormat("pt-BR", { type: "conjunction" });

/** Keep distinct time ranges visible when only some weekdays share a schedule. */
export function compactSchedule(
  slots: ClassPlan["slots"],
  width: "short" | "long" = "short",
): string {
  const ranges = new Map<string, Set<string>>();
  for (const { weekday, startTime, endTime } of slots) {
    const range = `${startTime}–${endTime}`;
    const days = ranges.get(range) ?? new Set<string>();
    const fullDay =
      weekday === "SATURDAY" || weekday === "SUNDAY"
        ? weekdays[weekday]
        : `${weekdays[weekday]}-feira`;
    days.add((width === "long" ? fullDay : shortWeekday(weekday)).toLocaleLowerCase("pt-BR"));
    ranges.set(range, days);
  }
  return [...ranges]
    .map(([range, days]) => {
      const label = dayList.format(days);
      return `${label.charAt(0).toLocaleUpperCase("pt-BR")}${label.slice(1)} · ${range}`;
    })
    .join(" / ");
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
  error,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  options: Record<string, string>;
  error?: string | undefined;
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
        invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
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
      {error && (
        <FieldError id={`${name}-error`} match>
          {error}
        </FieldError>
      )}
    </Field>
  );
}
