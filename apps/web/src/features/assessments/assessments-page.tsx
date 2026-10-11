"use client";
import { useState, type ReactElement } from "react";
import { Alert, Button, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { SelectControl } from "~/features/classes/form-controls";
import { ClassPerformance } from "./class-performance";
export function AssessmentsPage(): ReactElement {
  const query = trpc.assessments.classes.useQuery();
  const [selected, setSelected] = useState("");
  const current = query.data?.find((row) => row.id === selected) ?? query.data?.[0];
  return (
    <div className="mx-auto grid h-full w-full max-w-7xl content-start gap-6 overflow-y-auto p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h2 font-semibold">Avaliações</h1>
          <p className="mt-2 text-caption text-muted-foreground">
            Acompanhe as competências e registre as notas das suas turmas.
          </p>
        </div>
        {current && (
          <div className="w-full sm:w-72">
            <SelectControl
              name="assessment-class"
              label="Turma"
              value={current.id}
              onChange={setSelected}
              choices={(query.data ?? []).map((row) => ({
                value: row.id,
                label: `${row.name} · ${row.semester}`,
              }))}
            />
          </div>
        )}
      </header>
      {query.isPending && <InlineSkeleton className="h-60 w-full" />}
      {query.error && (
        <Alert variant="destructive">
          Não foi possível carregar as turmas.
          <Button variant="secondary" onClick={() => void query.refetch()}>
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
