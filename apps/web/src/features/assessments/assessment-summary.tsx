"use client";
import { useState, type ReactElement, type ReactNode } from "react";
import { Badge, Button, cn } from "@lazuli/ui";
import { formatDateOnlyBR } from "~/lib/format";
import { AssessmentDialog } from "./assessment-dialog";
import { ConfirmationDialog } from "./confirmation-dialog";
import { AssessmentResults } from "./results-table";
import { AcademicProgressChart } from "./progress-chart";
import { STATUS_LABELS, type Assessment } from "./shared";
import { AssessmentAttachments } from "~/features/assessment-files/attachments";

type SummaryProps = {
  data: Assessment;
  chart?: boolean;
  layout?: "stacked" | "profile";
  selector?: ReactNode;
  showHeading?: boolean;
};
export function AssessmentSummary({
  data,
  chart = true,
  layout = "stacked",
  selector,
  showHeading = true,
}: SummaryProps): ReactElement {
  const [dialog, setDialog] = useState<"grades" | "confirm" | null>(null);
  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {showHeading && <AssessmentHeading data={data} layout={layout} />}
        <div className="flex flex-wrap items-end gap-3">
          {selector}
          <div className="flex flex-wrap gap-2">
            <Button size="compact-responsive" onClick={() => setDialog("grades")}>
              {data.grades.length ? "Atualizar notas" : "Lançar notas"}
            </Button>
            {layout !== "profile" && data.canConfirm && !data.decision && (
              <Button
                variant="secondary"
                size="compact-responsive"
                disabled={data.status === "INCOMPLETE"}
                onClick={() => setDialog("confirm")}
              >
                Concluir avaliação
              </Button>
            )}
          </div>
        </div>
      </div>
      <div
        className={cn(
          "grid min-w-0 items-start gap-4",
          layout === "profile" && chart && "xl:grid-cols-5 xl:gap-6",
        )}
      >
        {chart && (
          <div
            className={cn(
              "min-w-0",
              layout === "profile" && "border border-border bg-accent p-4 xl:col-span-2",
            )}
          >
            <AcademicProgressChart data={data} />
          </div>
        )}
        <div className={cn("grid min-w-0 gap-3", layout === "profile" && chart && "xl:col-span-3")}>
          <AssessmentResults data={data} />
          <AssessmentDecision data={data} />
          {layout === "profile" &&
            data.canConfirm &&
            !data.decision &&
            data.status !== "INCOMPLETE" && (
              <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                <p className="text-caption text-muted-foreground">
                  Registre a aprovação ou a necessidade de repetir o estágio.
                </p>
                <Button variant="secondary" size="sm" onClick={() => setDialog("confirm")}>
                  Concluir avaliação
                </Button>
              </div>
            )}
        </div>
      </div>
      {dialog === "grades" && <AssessmentDialog data={data} onClose={() => setDialog(null)} />}
      <AssessmentAttachments progressId={data.progressId} studentId={data.student.id} />
      {dialog === "confirm" && <ConfirmationDialog data={data} onClose={() => setDialog(null)} />}
    </div>
  );
}

function AssessmentHeading({ data, layout }: Pick<SummaryProps, "data" | "layout">): ReactElement {
  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-3">
        {layout === "profile" ? (
          <h2 className="font-display text-xl font-semibold text-heading">Avaliações do estágio</h2>
        ) : (
          <h3 className="font-display text-h3 font-semibold">{data.stage.name}</h3>
        )}
        <AssessmentStatusBadge data={data} />
      </div>
      <p className="text-caption text-muted-foreground">
        {layout === "profile" && `${data.stage.name} · `}
        {data.stage.track.name} · Desde {formatDateOnlyBR(data.startedOn)}
      </p>
    </div>
  );
}

export function AssessmentStatusBadge({ data }: { data: Assessment }): ReactElement {
  return (
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
  );
}

function AssessmentDecision({ data }: { data: Assessment }): ReactElement | null {
  if (data.decision || data.status === "INCOMPLETE") return null;
  return (
    <p className="text-caption text-muted-foreground">
      A recuperação, quando lançada, substitui a média da competência.
    </p>
  );
}
