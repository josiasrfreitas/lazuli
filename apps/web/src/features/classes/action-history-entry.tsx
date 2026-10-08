import type { ReactElement, ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, PencilLine, RotateCcw, Pause } from "lucide-react";
import { Badge, Button } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";

export type HistoryRow = RouterOutputs["classes"]["actions"]["rows"][number];
const DATE_LENGTH = 10;
const kindLabel = {
  ENTRY: "Matrícula",
  RETURN: "Retorno",
  PAUSE: "Pausa",
  EXIT: "Saída",
  CORRECTION: "Correção",
} as const;
const statusLabel = {
  SCHEDULED: "Programada",
  APPLIED: "Efetivada",
  CANCELLED: "Cancelada",
} as const;
const icons = {
  ENTRY: ArrowDownLeft,
  RETURN: RotateCcw,
  PAUSE: Pause,
  EXIT: ArrowUpRight,
  CORRECTION: PencilLine,
};
type Controls = {
  pending: boolean;
  cancel: (id: string) => void;
  correct: (row: HistoryRow) => void;
};
function actionControl(row: HistoryRow, input: Controls): ReactNode {
  if (row.status === "SCHEDULED")
    return (
      <Button
        size="sm"
        variant="text"
        disabled={input.pending}
        onClick={() => input.cancel(row.id)}
      >
        Cancelar
      </Button>
    );
  return null;
}
export function ActionHistoryEntry({ row, controls }: ActionHistoryEntryInput): ReactElement {
  const Icon = icons[row.kind];
  return (
    <li className="relative flex gap-3 pb-5">
      <div
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-body">
            <span className="font-semibold">{row.enrollment.student.fullName}</span>
            <span className="text-muted-foreground"> · {kindLabel[row.kind]}</span>
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <ActionEffectiveDate row={row} />
            {row.status === "APPLIED" && row.kind !== "CORRECTION" && (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Corrigir data de ${row.enrollment.student.fullName}`}
                title="Corrigir data"
                onClick={() => controls.correct(row)}
              >
                <PencilLine aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Badge variant={row.status === "SCHEDULED" ? "info" : "neutral"}>
            {statusLabel[row.status]}
          </Badge>
          <p className="text-caption text-muted-foreground">Registrado por {row.recordedBy.name}</p>
          {actionControl(row, controls)}
        </div>
        {row.justification && (
          <p className="text-caption text-muted-foreground">{row.justification}</p>
        )}
      </div>
    </li>
  );
}

type ActionEffectiveDateProps = {
  row: HistoryRow;
};
function ActionEffectiveDate(props: ActionEffectiveDateProps): ReactElement {
  return (
    <time
      className="font-numeric text-caption tabular-nums text-muted-foreground"
      dateTime={props.row.effectiveDate.toISOString().slice(0, DATE_LENGTH)}
    >
      {props.row.effectiveDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
    </time>
  );
}

type ActionHistoryEntryInput = {
  row: HistoryRow;
  controls: Controls;
};
