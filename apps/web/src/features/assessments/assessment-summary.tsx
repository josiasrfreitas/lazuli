"use client";
import { useState, type ReactElement } from "react";
import { Badge, Button } from "@lazuli/ui";
import { formatDateOnlyBR } from "~/lib/format";
import { AssessmentDialog } from "./assessment-dialog";
import { ConfirmationDialog } from "./confirmation-dialog";
import { AssessmentResults } from "./results-table";
import { AcademicProgressChart } from "./progress-chart";
import { STATUS_LABELS, type Assessment } from "./shared";

export function AssessmentSummary({
  data,
  chart = true,
}: {
  data: Assessment;
  chart?: boolean;
}): ReactElement {
  const [dialog, setDialog] = useState<"grades" | "confirm" | null>(null);
  return (
    <div className="grid min-w-0 gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <h3 className="font-display text-h3 font-semibold">{data.stage.name}</h3>
          <p className="text-caption text-muted-foreground">
            {data.stage.track.name} · Desde {formatDateOnlyBR(data.startedOn)}
          </p>
          <Badge
            variant={
              data.decision === "APPROVED"
                ? "success"
                : data.status === "NEEDS_SUPPORT"
                  ? "warning"
                  : "neutral"
            }
          >
            {data.decision === "APPROVED"
              ? "Aprovação confirmada"
              : data.decision === "REPEAT"
                ? "Repetência confirmada"
                : STATUS_LABELS[data.status]}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="compact-responsive" onClick={() => setDialog("grades")}>
            {data.grades.length ? "Editar notas" : "Lançar notas"}
          </Button>
          {data.canConfirm && !data.decision && (
            <Button
              variant="secondary"
              size="compact-responsive"
              disabled={data.status === "INCOMPLETE"}
              onClick={() => setDialog("confirm")}
            >
              Confirmar resultado
            </Button>
          )}
        </div>
      </div>
      {chart && <AcademicProgressChart data={data} />}
      <AssessmentResults data={data} />
      {data.confirmedBy && (
        <div className="grid gap-1 border-t border-border pt-3">
          <p className="text-caption font-medium">Resultado confirmado por {data.confirmedBy}</p>
          <p className="text-caption text-muted-foreground">{data.decisionReason}</p>
        </div>
      )}
      {!data.decision && (
        <p className="text-caption text-muted-foreground">
          O resultado depende da confirmação pedagógica. Recuperação substitui a média da
          competência; os blocos originais permanecem registrados.
        </p>
      )}
      {dialog === "grades" && <AssessmentDialog data={data} onClose={() => setDialog(null)} />}
      {dialog === "confirm" && <ConfirmationDialog data={data} onClose={() => setDialog(null)} />}
    </div>
  );
}
