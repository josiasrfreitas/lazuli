"use client";
import type { ReactElement } from "react";
import { parseAsString, useQueryStates } from "nuqs";
import { EmptyState } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { SelectControl } from "~/features/classes/form-controls";
import { PlanningWorkspace } from "./workspace";
import { PlanningState } from "./shared";
export function PlanningPage(): ReactElement {
  const [params, setParams] = useQueryStates({
    turma: parseAsString.withDefault(""),
    percurso: parseAsString.withDefault(""),
  });
  const query = trpc.planning.contexts.useQuery();
  const classId = params.turma || query.data?.[0]?.id;
  const group = query.data?.find((row) => row.id === classId);
  const progressId =
    params.percurso ||
    (group?.scheduleType === "PERSONALIZED" ? group.students[0]?.progressId : undefined);
  const ready = classId && (group?.scheduleType !== "PERSONALIZED" || progressId);
  return (
    <div className="mx-auto grid h-full w-full min-w-0 max-w-7xl content-start gap-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-h2 font-semibold text-heading">Planejamento</h1>
          <p className="mt-1 text-caption text-muted-foreground">
            O caminho previsto para cada estágio, com espaço para revisar.
          </p>
        </div>
      </header>
      <PlanningState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && query.data.length > 0 && (
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:max-w-xs">
            <SelectControl
              name="planning-class"
              label="Turma"
              value={classId ?? ""}
              choices={query.data.map((row) => ({
                value: row.id,
                label: `${row.name} · ${row.semester}`,
              }))}
              onChange={(turma) => void setParams({ turma, percurso: null })}
            />
          </div>
          {group?.scheduleType === "PERSONALIZED" && group.students.length > 0 && (
            <div className="w-full sm:max-w-sm">
              <SelectControl
                name="planning-student"
                label="Aluno e estágio"
                value={progressId ?? ""}
                choices={group.students.map((student) => ({
                  value: student.progressId,
                  label: `${student.name} · ${student.stage}${student.historical ? " · histórico" : ""}`,
                }))}
                onChange={(percurso) => void setParams({ percurso })}
              />
            </div>
          )}
        </div>
      )}
      {ready && (
        <PlanningWorkspace
          key={`${classId}/${progressId ?? "shared"}`}
          classId={classId}
          progressId={progressId}
        />
      )}
      {query.data && !query.data.length && !params.turma && (
        <EmptyState
          title="Nenhuma turma disponível"
          description="O planejamento aparece nas turmas sob sua responsabilidade."
        />
      )}
      {group?.scheduleType === "PERSONALIZED" && !progressId && (
        <EmptyState
          title="Nenhum percurso para planejar"
          description="Aloque os alunos e defina seus estágios para organizar o planejamento individual."
        />
      )}
    </div>
  );
}
