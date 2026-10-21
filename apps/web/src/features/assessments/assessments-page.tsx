"use client";
import { RefreshCw } from "lucide-react";
import { useState, type ReactElement } from "react";
import { Alert, Button, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { SelectControl } from "~/features/classes/form-controls";
import { ClassPerformance } from "./class-performance";
import { ClassPerformanceLoading } from "./assessment-loading";
export function AssessmentsPage(): ReactElement {
  const query = trpc.assessments.classes.useQuery();
  const [selected, setSelected] = useState("");
  const current = query.data?.find((row) => row.id === selected) ?? query.data?.[0];
  return (
    <div className="mx-auto grid h-full w-full max-w-7xl content-start gap-4 overflow-y-auto p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h3 font-semibold">Avaliações</h1>
          <p className="mt-1 text-caption text-muted-foreground">
            Acompanhe as competências e registre as notas das suas turmas.
          </p>
        </div>
        <AssessmentClassSelector
          pending={query.isPending}
          current={current}
          rows={query.data ?? []}
          onSelect={setSelected}
        />
      </header>
      {query.isPending && <ClassPerformanceLoading />}
      {query.error && (
        <Alert variant="destructive">
          Não foi possível carregar as turmas.
          <Button variant="secondary" onClick={() => void query.refetch()}>
            <RefreshCw aria-hidden="true" />
            Tentar novamente
          </Button>
        </Alert>
      )}
      {current && <ClassPerformance classId={current.id} />}
      {query.data?.length === 0 && (
        <p className="text-caption text-muted-foreground">
          Nenhuma turma sob sua responsabilidade neste momento.
        </p>
      )}
    </div>
  );
}

type ClassChoice = { id: string; name: string; semester: string };
function AssessmentClassSelector({
  pending,
  current,
  rows,
  onSelect,
}: {
  pending: boolean;
  current: ClassChoice | undefined;
  rows: ClassChoice[];
  onSelect: (id: string) => void;
}): ReactElement | null | undefined {
  return pending ? (
    <div className="grid w-full gap-2 sm:w-72" aria-hidden="true">
      <span className="text-caption text-muted-foreground">Turma</span>
      <InlineSkeleton className="h-8 w-full rounded-sm" />
    </div>
  ) : (
    current && (
      <div className="w-full sm:w-72">
        <SelectControl
          name="assessment-class"
          label="Turma"
          value={current.id}
          onChange={onSelect}
          choices={rows.map((row) => ({
            value: row.id,
            label: `${row.name} · ${row.semester}`,
          }))}
        />
      </div>
    )
  );
}
