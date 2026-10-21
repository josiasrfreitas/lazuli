"use client";
import { ArrowLeft } from "lucide-react";
import type { ReactElement } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { Button, EmptyState } from "@lazuli/ui";
import { saoPauloDateOnly } from "@lazuli/domain";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { SelectControl } from "~/features/classes/form-controls";
import { PlanningLoading } from "./planning-loading";
import { PlanningWorkspace } from "./workspace";
import { PlanningState, dateLabel } from "./shared";
import styles from "./planning.module.css";

type Contexts = RouterOutputs["planning"]["contexts"];
type StudentOption = Contexts[number]["students"][number] & { classId: string; className: string };
export function studentPlanningOptions(contexts: Contexts, studentId: string): StudentOption[] {
  const today = saoPauloDateOnly(new Date());
  return contexts
    .flatMap((group) =>
      group.students
        .filter((student) => student.studentId === studentId)
        .map((student) => ({ ...student, classId: group.id, className: group.name })),
    )
    .toSorted(
      (left, right) =>
        Number(left.historical) - Number(right.historical) ||
        Number(left.startOn > today) - Number(right.startOn > today) ||
        right.startOn.localeCompare(left.startOn),
    );
}

export function StudentPlanning({ studentId }: { studentId: string }): ReactElement {
  const query = trpc.planning.contexts.useQuery();
  const [progressId, setProgressId] = useQueryState("percurso", parseAsString);
  const options = studentPlanningOptions(query.data ?? [], studentId);
  const selected = progressId ? options.find((row) => row.progressId === progressId) : options[0];
  if (query.isPending) return <PlanningLoading />;
  return (
    <div className={styles.student}>
      <PlanningState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && (
        <StudentSelector
          options={options}
          selected={selected}
          select={(value) => {
            void setProgressId(value);
          }}
        />
      )}
      {selected && (
        <PlanningWorkspace
          key={selected.progressId}
          classId={selected.classId}
          progressId={selected.progressId}
        />
      )}
      {query.data && !selected && (
        <StudentPlanEmpty
          progressId={progressId}
          hasOptions={options.length > 0}
          reset={() => {
            void setProgressId(null);
          }}
        />
      )}
    </div>
  );
}

function StudentSelector({
  options,
  selected,
  select,
}: {
  options: StudentOption[];
  selected: StudentOption | undefined;
  select: (id: string) => void;
}): ReactElement | null {
  if (options.length <= 1) return null;
  return (
    <div className={styles.selector}>
      <SelectControl
        name="planning-progress"
        label="Estágio do aluno"
        value={selected?.progressId ?? ""}
        choices={options.map((row) => ({
          value: row.progressId,
          label: `${row.stage} · ${row.className} · ${dateLabel(row.startOn)}${row.historical ? " · histórico" : ""}`,
        }))}
        onChange={(value) => select(value)}
      />
    </div>
  );
}

function StudentPlanEmpty({
  progressId,
  hasOptions,
  reset,
}: {
  progressId: string | null;
  hasOptions: boolean;
  reset: () => void;
}): ReactElement {
  return (
    <EmptyState
      action={
        hasOptions ? (
          <Button variant="secondary" onClick={reset}>
            <ArrowLeft aria-hidden="true" />
            Ver percurso atual
          </Button>
        ) : undefined
      }
      title={progressId ? "Percurso não disponível" : "Nenhum estágio PPT disponível"}
      description={
        progressId
          ? "Este percurso não pertence ao aluno ou não está disponível para seu acesso."
          : "O planejamento individual fica disponível quando o aluno possui um estágio em uma turma PPT."
      }
    />
  );
}
