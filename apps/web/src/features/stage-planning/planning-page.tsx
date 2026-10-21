"use client";
import type { RouterOutputs } from "@lazuli/api";
import type { ReactElement } from "react";
import { useQueryStates, parseAsString } from "nuqs";
import { EmptyState } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { SelectControl } from "~/features/classes/form-controls";
import { PlanningWorkspace } from "./workspace";
import { PlanningState } from "./shared";

export function PlanningPage({
  classId: fixedClassId,
}: {
  classId?: string | undefined;
}): ReactElement {
  const query = trpc.planning.contexts.useQuery();
  const [selection, setSelection] = useQueryStates({
    turma: parseAsString,
    percurso: parseAsString,
  });
  const { group, progress } = planningChoice(query.data, {
    classId: fixedClassId ?? selection.turma,
    progressId: selection.percurso,
  });
  return (
    <div
      className={
        fixedClassId
          ? "grid min-w-0 content-start gap-5"
          : "grid min-w-0 content-start gap-5 p-4 sm:p-6"
      }
    >
      {!fixedClassId && <h1 className="font-display text-h1 text-heading">Planejamento</h1>}
      <PlanningState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && (
        <ContextSelectors
          contexts={query.data}
          group={group}
          progress={progress}
          fixed={Boolean(fixedClassId)}
          select={(value) => {
            void setSelection(value);
          }}
        />
      )}
      {query.data && <SelectedPlanning group={group} progress={progress} />}
    </div>
  );
}

type Group = RouterOutputs["planning"]["contexts"][number];
type Choice = { group: Group | undefined; progress: Group["students"][number] | undefined };
function ContextSelectors({
  contexts,
  group,
  progress,
  fixed,
  select,
}: Choice & {
  contexts: Group[];
  fixed: boolean;
  select: (value: { turma?: string | null; percurso?: string | null }) => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-start gap-3">
      {!fixed && (
        <div className="w-full min-w-0 sm:w-72">
          <SelectControl
            name="planning-class"
            label="Turma"
            value={group?.id ?? ""}
            choices={contexts.map((row) => ({
              value: row.id,
              label: `${row.name} · ${row.semester}`,
            }))}
            onChange={(value) => {
              select({ turma: value, percurso: null });
            }}
          />
        </div>
      )}
      {group?.scheduleType === "PERSONALIZED" && (
        <div className="w-full min-w-0 sm:w-80">
          <SelectControl
            name="planning-student"
            label="Percurso do aluno"
            value={progress?.progressId ?? ""}
            choices={group.students.map((row) => ({
              value: row.progressId,
              label: `${row.name} · ${row.stage}${row.historical ? " · histórico" : ""}`,
            }))}
            onChange={(value) => select({ percurso: value })}
          />
        </div>
      )}
    </div>
  );
}

function SelectedPlanning({ group, progress }: Choice): ReactElement {
  return (
    <>
      {" "}
      {group && (group.scheduleType === "REGULAR" || progress) ? (
        <PlanningWorkspace
          key={`${group.id}/${progress?.progressId ?? "shared"}`}
          classId={group.id}
          {...(group.scheduleType === "PERSONALIZED" && progress
            ? { progressId: progress.progressId }
            : {})}
        />
      ) : (
        <EmptyState
          title="Nenhum contexto de planejamento"
          description="Selecione uma turma com estágio ou um percurso individual PPT."
        />
      )}
    </>
  );
}

function planningChoice(
  contexts: Group[] | undefined,
  { classId, progressId }: { classId: string | null; progressId: string | null },
): Choice {
  const group = classId ? contexts?.find((row) => row.id === classId) : contexts?.[0];
  const progress =
    group?.students.find((row) => row.progressId === progressId) ?? group?.students[0];
  return { group, progress };
}
