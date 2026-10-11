import type { RouterOutputs } from "@lazuli/api";
import { Badge, Field, Label, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
export type SemesterBoard = RouterOutputs["semesterOrganization"]["detail"];
export type ClassPlan = SemesterBoard["plans"][number];
export type Placement = SemesterBoard["placements"][number];
export type StudentContext = RouterOutputs["semesterOrganization"]["student"];
export const modes = {
  ENTRY: "Nova entrada",
  CONTINUE: "Continuar PPT",
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
export const dateOnly = (date: Date | string) =>
  typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);
export function scheduleLabel(slots: ClassPlan["slots"]) {
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
      utils.activity.invalidate(),
    ]);
  };
}
export function PlacementBadge({ row }: { row: Placement }) {
  return (
    <Badge
      variant={
        row.publishedAt
          ? row.blockers.length
            ? "warning"
            : "success"
          : row.blockers.length
            ? "neutral"
            : "info"
      }
    >
      {row.publishedAt
        ? row.entryStatus === "APPLIED"
          ? "Efetivada"
          : row.blockers.length
            ? "Revisar publicação"
            : "Publicada"
        : row.blockers.length
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
}) {
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
