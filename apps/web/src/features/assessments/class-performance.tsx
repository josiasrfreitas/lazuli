"use client";
import { RefreshCw } from "lucide-react";
import { useState, type ReactElement } from "react";
import { Alert, Button } from "@lazuli/ui";
import { ClassPerformanceLoading } from "./assessment-loading";
import { trpc } from "~/lib/trpc";
import { SelectControl } from "~/features/classes/form-controls";
import { ClassPerformanceChart } from "./class-chart";
import { AssessmentSummary } from "./assessment-summary";
import { STATUS_LABELS, type Assessment } from "./shared";

export function ClassPerformance({ classId }: { classId: string }): ReactElement {
  const query = trpc.assessments.class.useQuery({ classId });
  if (query.isPending) return <ClassPerformanceLoading />;
  if (query.isError)
    return (
      <Alert variant="destructive">
        Não foi possível carregar o desempenho.
        <Button variant="secondary" onClick={() => void query.refetch()}>
          <RefreshCw aria-hidden="true" />
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
      className="grid min-w-0 shrink-0 gap-3 rounded-lg border border-border bg-card p-3 sm:p-4"
      aria-label="Desempenho da turma"
    >
      <PerformanceHeader
        stages={stages}
        stageId={stageId}
        onStageChange={(value) => {
          setStageId(value);
          setStudentId("none");
        }}
      />
      {rows.length === 0 ? (
        <p className="text-caption text-muted-foreground">
          O desempenho aparece quando houver alunos com percurso vigente nesta turma.
        </p>
      ) : (
        <PerformanceDetails
          visible={visible}
          selected={selected}
          stages={stages}
          stageId={stageId}
          setStudentId={setStudentId}
        />
      )}
    </section>
  );
}
function PerformanceCounts({ rows }: { rows: Assessment[] }): ReactElement {
  return (
    <dl className="grid grid-cols-3 divide-x divide-border border-y border-border py-2">
      {(["SUFFICIENT", "NEEDS_SUPPORT", "INCOMPLETE"] as const).map((status, index) => (
        <div key={status} className={index ? "px-3 sm:px-5" : "pr-3 sm:pr-5"}>
          <dd
            className={`font-numeric text-lg font-semibold tabular-nums ${status === "NEEDS_SUPPORT" ? "text-warning" : "text-heading"}`}
          >
            {rows.filter((row) => row.status === status).length}
          </dd>
          <dt className="mt-1 text-caption text-muted-foreground">{STATUS_LABELS[status]}</dt>
        </div>
      ))}
    </dl>
  );
}

type PerformanceHeaderProps = {
  stages: [string, string][];
  stageId: string;
  onStageChange: (value: string) => void;
};
function PerformanceHeader({
  stages,
  stageId,
  onStageChange,
}: PerformanceHeaderProps): ReactElement {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold">Desempenho da turma</h2>
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
            onChange={onStageChange}
            choices={[
              { value: "all", label: "Todos os estágios" },
              ...stages.map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>
      )}
    </div>
  );
}

type PerformanceDetailsProps = {
  visible: Assessment[];
  selected: Assessment | undefined;
  stages: [string, string][];
  stageId: string;
  setStudentId: (value: string) => void;
};
function PerformanceDetails({
  visible,
  selected,
  stages,
  stageId,
  setStudentId,
}: PerformanceDetailsProps): ReactElement {
  return (
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
        <div className="border-t border-border pt-3">
          <AssessmentSummary key={selected.progressId} data={selected} chart={false} />
        </div>
      )}
    </>
  );
}
