"use client";
import { useState, type ReactElement } from "react";
import { Alert, Button, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { SelectControl } from "~/features/classes/form-controls";
import { ClassPerformanceChart } from "./class-chart";
import { AssessmentSummary } from "./assessment-summary";
import { STATUS_LABELS, type Assessment } from "./shared";

export function ClassPerformance({ classId }: { classId: string }): ReactElement {
  const query = trpc.assessments.class.useQuery({ classId });
  if (query.isPending) return <InlineSkeleton className="h-60 w-full shrink-0" />;
  if (query.isError)
    return (
      <Alert variant="destructive">
        Não foi possível carregar o desempenho.
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      </Alert>
    );
  return <PerformanceWorkspace key={classId} rows={query.data} />;
}
function PerformanceWorkspace({ rows }: { rows: Assessment[] }): ReactElement {
  const [studentId, setStudentId] = useState("none");
  const [stageId, setStageId] = useState("all");
  const stages = [...new Map(rows.map((row) => [row.stage.id, row.stage.name])).entries()];
  const visible = stageId === "all" ? rows : rows.filter((row) => row.stage.id === stageId);
  const selected = visible.find((row) => row.student.id === studentId);
  return (
    <section
      className="grid min-w-0 shrink-0 gap-5 rounded-lg border border-border bg-card p-4 sm:p-6"
      aria-label="Desempenho da turma"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-h3 font-semibold">Desempenho da turma</h2>
          <p className="mt-1 text-caption text-muted-foreground">
            Aprendizagem por competência · Alunos com vínculo vigente
          </p>
        </div>
        {stages.length > 1 && (
          <div className="w-full sm:w-56">
            <SelectControl
              name="performance-stage"
              label="Estágio"
              value={stageId}
              onChange={(value) => {
                setStageId(value);
                setStudentId("none");
              }}
              choices={[
                { value: "all", label: "Todos os estágios" },
                ...stages.map(([value, label]) => ({ value, label })),
              ]}
            />
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-caption text-muted-foreground">
          O desempenho aparece quando houver alunos com percurso vigente nesta turma.
        </p>
      ) : (
        <>
          <PerformanceCounts rows={visible} />
          <ClassPerformanceChart rows={visible} selected={selected} />
          {stages.length > 1 && stageId === "all" && (
            <p className="text-caption text-muted-foreground">
              Esta turma reúne estágios diferentes. Filtre um estágio para comparar alunos no mesmo
              momento do curso.
            </p>
          )}
          <div className="w-full sm:max-w-sm">
            <SelectControl
              name="performance-student"
              label="Comparar e acompanhar um aluno"
              value={selected?.student.id ?? "none"}
              onChange={setStudentId}
              choices={[
                { value: "none", label: "Visão da turma" },
                ...visible.map((row) => ({ value: row.student.id, label: row.student.fullName })),
              ]}
            />
          </div>
          {selected && (
            <div className="border-t border-border pt-5">
              <AssessmentSummary key={selected.progressId} data={selected} chart={false} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
function PerformanceCounts({ rows }: { rows: Assessment[] }): ReactElement {
  return (
    <dl className="grid grid-cols-3 divide-x divide-border border-y border-border py-4">
      {(["SUFFICIENT", "NEEDS_SUPPORT", "INCOMPLETE"] as const).map((status, index) => (
        <div key={status} className={index ? "px-3 sm:px-5" : "pr-3 sm:pr-5"}>
          <dd
            className={`font-numeric text-2xl font-semibold tabular-nums ${status === "NEEDS_SUPPORT" ? "text-warning" : "text-heading"}`}
          >
            {rows.filter((row) => row.status === status).length}
          </dd>
          <dt className="mt-1 text-caption text-muted-foreground">{STATUS_LABELS[status]}</dt>
        </div>
      ))}
    </dl>
  );
}
