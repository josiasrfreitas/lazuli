import { Badge } from "@lazuli/ui";
import { dateLabel } from "./format";
export function TeacherStatus({
  departure,
  today,
}: {
  departure: Date | null | undefined;
  today: string;
}) {
  if (!departure) return <Badge variant="success">Em atuação</Badge>;
  if (departure.toISOString().slice(0, 10) > today)
    return (
      <span className="flex flex-wrap items-center gap-2">
        <Badge variant="warning">Saída programada</Badge>
        <span className="text-caption text-muted-foreground">{dateLabel(departure)}</span>
      </span>
    );
  return <Badge variant="neutral">Atuação encerrada</Badge>;
}
