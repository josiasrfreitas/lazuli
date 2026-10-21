"use client";
import { useState, type ReactElement, type ReactNode } from "react";
import { Badge, Button } from "@lazuli/ui";
import { formatDateOnlyBR } from "~/lib/format";
import { Check } from "lucide-react";
import { AssessmentWorkspace } from "./assessment-workspace";
import { ConfirmationDialog } from "./confirmation-dialog";
import { AcademicProgressChart } from "./progress-chart";
import { STATUS_LABELS, type Assessment } from "./shared";

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
  const [confirming, setConfirming] = useState(false);
  const [editorState, setEditorState] = useState({ dirty: false, pending: false });
  return (
    <div className="grid w-full min-w-0 gap-3">
      {(showHeading || selector) && (
        <div className="flex flex-wrap items-end justify-between gap-2">
          {showHeading && <AssessmentHeading data={data} layout={layout} />}
          {selector}
        </div>
      )}
      <AssessmentWorkspace data={data} onStateChange={setEditorState} />
      <AssessmentDecision data={data} />
      <ConcludeAssessmentButton
        data={data}
        editorState={editorState}
        onConfirm={() => setConfirming(true)}
      />
      {chart && (
        <details className="min-w-0 text-caption">
          <summary className="w-fit cursor-pointer py-1 text-interactive">
            Evolução das notas
          </summary>
          <div className="pt-2">
            <AcademicProgressChart data={data} />
          </div>
        </details>
      )}
      {confirming && <ConfirmationDialog data={data} onClose={() => setConfirming(false)} />}
    </div>
  );
}

function AssessmentHeading({ data, layout }: Pick<SummaryProps, "data" | "layout">): ReactElement {
  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-3">
        {layout === "profile" ? (
          <h2 className="font-display text-base font-semibold text-heading">
            Avaliações do estágio
          </h2>
        ) : (
          <h3 className="font-display text-base font-semibold">{data.stage.name}</h3>
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
  return <Badge variant={assessmentBadgeVariant(data)}>{assessmentBadgeLabel(data)}</Badge>;
}

function AssessmentDecision({ data }: { data: Assessment }): ReactElement | null {
  if (data.decision || data.status === "INCOMPLETE") return null;
  return (
    <p className="text-caption text-muted-foreground">
      A recuperação, quando lançada, substitui a média da competência.
    </p>
  );
}

function ConcludeAssessmentButton({
  data,
  editorState,
  onConfirm,
}: {
  data: Assessment;
  editorState: { dirty: boolean; pending: boolean };
  onConfirm: () => void;
}): ReactElement | null {
  return data.canConfirm && !data.decision && data.status !== "INCOMPLETE" ? (
    <Button
      variant="secondary"
      size="sm"
      className="w-fit"
      disabled={editorState.dirty || editorState.pending}
      title={editorState.dirty ? "Salve as alterações antes de concluir a avaliação." : undefined}
      onClick={onConfirm}
    >
      <Check aria-hidden="true" />
      Concluir avaliação
    </Button>
  ) : null;
}

function assessmentBadgeVariant(data: Assessment): "success" | "warning" | "neutral" {
  if (data.decision === "APPROVED") return "success";
  return data.status === "NEEDS_SUPPORT" ? "warning" : "neutral";
}
function assessmentBadgeLabel(data: Assessment): string {
  if (data.decision === "APPROVED") return "Aprovação confirmada";
  if (data.decision === "REPEAT") return "Repetência confirmada";
  return STATUS_LABELS[data.status];
}
