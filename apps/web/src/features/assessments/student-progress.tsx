"use client";
import { useState, type ReactElement } from "react";
import { Alert, Button, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { SelectControl } from "~/features/classes/form-controls";
import { formatDateOnlyBR } from "~/lib/format";
import { AssessmentSummary } from "./assessment-summary";

export function StudentAcademicProgress({ studentId }: { studentId: string }): ReactElement {
  const query = trpc.assessments.student.useQuery({ studentId });
  const [selected, setSelected] = useState("");
  const rows = query.data ?? [];
  const active =
    rows.find((row) => row.progressId === selected) ?? rows.find((row) => row.current) ?? rows[0];
  return (
    <section
      className="grid min-w-0 gap-5 rounded-lg border border-border bg-card p-4 sm:p-6"
      aria-label="Progressão acadêmica"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-h3 font-semibold">Progressão acadêmica</h2>
          <p className="mt-1 text-caption text-muted-foreground">
            Desempenho por competência ao longo do estágio.
          </p>
        </div>
        {rows.length > 1 && (
          <div className="w-full sm:w-64">
            <SelectControl
              name="academic-journey"
              label="Percurso"
              value={active?.progressId ?? ""}
              onChange={setSelected}
              choices={rows.map((row) => ({
                value: row.progressId,
                label: `${row.stage.name} · ${formatDateOnlyBR(row.startedOn)}`,
              }))}
            />
          </div>
        )}
      </div>
      {query.isPending && <InlineSkeleton className="h-60 w-full" />}
      {query.isError && (
        <Alert variant="destructive">
          Não foi possível carregar as avaliações.
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </Alert>
      )}
      {active && <AssessmentSummary key={active.progressId} data={active} />}
      {!query.isPending && !query.isError && !active && (
        <p className="text-caption text-muted-foreground">
          As avaliações ficam disponíveis quando o aluno inicia um estágio.
        </p>
      )}
    </section>
  );
}
