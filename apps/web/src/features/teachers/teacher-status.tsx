import type { ReactElement } from "react";
import { Badge } from "@lazuli/ui";
import { dateLabel } from "./format";

const ISO_DATE_LENGTH = 10;

export function TeacherStatus({ departure, today }: TeacherStatusInput): ReactElement {
  if (!departure) return <Badge variant="success">Ativa</Badge>;
  if (departure.toISOString().slice(0, ISO_DATE_LENGTH) > today)
    return (
      <span className="flex flex-wrap items-center gap-2">
        <Badge variant="warning">Saída programada</Badge>
        <span className="text-caption text-muted-foreground">{dateLabel(departure)}</span>
      </span>
    );
  return <Badge variant="neutral">Inativa</Badge>;
}

type TeacherStatusInput = {
  departure: Date | null | undefined;
  today: string;
};
