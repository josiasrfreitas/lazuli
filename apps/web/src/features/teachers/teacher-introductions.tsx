import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@lazuli/ui";
import { dateLabel } from "./format";

type Introduction = RouterOutputs["teachers"]["week"]["introductions"][number];
export function TeacherIntroductions({ rows }: { rows: Introduction[] }): ReactElement | null {
  if (!rows.length) return null;
  return (
    <section
      className="grid gap-3 rounded-md border border-border bg-card p-4"
      aria-label="Aulas introdutórias"
    >
      <h3 className="text-control font-semibold">Aulas introdutórias</h3>
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="grid gap-1">
              <Link
                className="inline-flex items-center gap-2 font-medium underline-offset-4 hover:underline"
                href={`/interessados/${row.candidateId}`}
              >
                {row.candidateName}
                <ArrowUpRight className="size-3" />
              </Link>
              <p className="font-numeric text-caption text-muted-foreground">
                {dateLabel(row.date)} · {row.startTime}–{row.endTime} ·{" "}
                {row.format === "ONLINE" ? "Online" : "Presencial"}
              </p>
            </div>
            <Badge variant={row.status === "ATTENDED" ? "success" : "neutral"}>
              {
                {
                  SCHEDULED: "Agendada",
                  ATTENDED: "Compareceu",
                  ABSENT: "Não compareceu",
                  CANCELLED: "Cancelada",
                }[row.status]
              }
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}
