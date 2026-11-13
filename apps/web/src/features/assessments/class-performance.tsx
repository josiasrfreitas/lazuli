"use client";
import { RefreshCw, ChartNoAxesCombined } from "lucide-react";
import { useState, type ReactElement, type ReactNode } from "react";
import { ToastAlert, Button, Field, Label, SearchSelect } from "@lazuli/ui";
import { normalizeSearch } from "@lazuli/domain";
import { ClassPerformanceLoading } from "./assessment-loading";
import { trpc } from "~/lib/trpc";
import { SelectControl } from "~/features/classes/form-controls";
import { ClassPerformanceChart } from "./class-chart";
import { AssessmentSummary } from "./assessment-summary";
import { STATUS_LABELS, type Assessment } from "./shared";
import styles from "./class-performance.module.css";

export function ClassPerformance({ classId }: { classId: string }): ReactElement {
  const query = trpc.assessments.class.useQuery({ classId });
  if (query.isPending)
    return (
      <div className={`dark ${styles.loading}`}>
        <ClassPerformanceLoading />
      </div>
    );
  if (query.isError)
    return (
      <ToastAlert variant="destructive">
        Não foi possível carregar o desempenho.
        <Button variant="secondary" onClick={() => void query.refetch()}>
          <RefreshCw aria-hidden="true" />
          Tentar novamente
        </Button>
      </ToastAlert>
    );
  if (!query.data.some((row) => row.grades.length > 0))
    return (
      <section className={`dark ${styles.workspace}`} aria-label="Desempenho da turma">
        <h2 className={styles.heading}>Desempenho da turma</h2>
        <div className={styles.empty} role="status">
          <ChartNoAxesCombined aria-hidden="true" />
          <h3>Os gráficos ainda estão no intervalo</h3>
          <p>Assim que as primeiras notas forem lançadas, o desempenho da turma aparece aqui.</p>
        </div>
      </section>
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
    <section className={`dark ${styles.workspace}`} aria-label="Desempenho da turma">
      <PerformanceHeader
        stages={stages}
        stageId={stageId}
        onStageChange={(value) => {
          setStageId(value);
          setStudentId("none");
        }}
      >
        <StudentSearch key={stageId} rows={visible} selected={selected} onChange={setStudentId} />
      </PerformanceHeader>
      {rows.length === 0 ? (
        <p className="text-caption text-muted-foreground">
          O desempenho aparece quando houver alunos com percurso vigente nesta turma.
        </p>
      ) : (
        <>
          <PerformanceCounts rows={visible} />
          <MixedStagesNotice show={stages.length > 1 && stageId === "all"} />
          <div className={styles.content} data-comparing={!!selected}>
            <ClassPerformanceChart rows={visible} selected={selected} />
            {selected && <StudentAssessment selected={selected} />}
          </div>
        </>
      )}
    </section>
  );
}
function StudentSearch({
  rows,
  selected,
  onChange,
}: {
  rows: Assessment[];
  selected: Assessment | undefined;
  onChange: (value: string) => void;
}): ReactElement {
  const [search, setSearch] = useState("");
  const students = [...new Map(rows.map((row) => [row.student.id, row.student])).values()];
  return (
    <Field name="performance-student" className="w-80 max-w-full">
      <Label className="sr-only">Comparar com um aluno</Label>
      <SearchSelect
        name="performance-student"
        placeholder="Buscar aluno para comparar"
        showSearchIcon
        openOnFocus
        query={search}
        onQueryChange={setSearch}
        value={selected ? { id: selected.student.id, label: selected.student.fullName } : null}
        options={students
          .filter((student) => normalizeSearch(student.fullName).includes(normalizeSearch(search)))
          .map((student) => ({ id: student.id, label: student.fullName }))}
        onSelect={(option) => {
          onChange(option.id);
          setSearch("");
        }}
        onClear={() => {
          onChange("none");
          setSearch("");
        }}
        emptyMessage="Nenhum aluno encontrado nesta turma."
      />
    </Field>
  );
}
function StudentAssessment({ selected }: { selected: Assessment }): ReactElement {
  return (
    <div
      className={styles.studentDetails}
      tabIndex={0}
      role="region"
      aria-label="Avaliações do aluno selecionado"
    >
      <AssessmentSummary key={selected.progressId} data={selected} chart={false} />
    </div>
  );
}
function MixedStagesNotice({ show }: { show: boolean }): ReactElement | null {
  if (!show) return null;
  return (
    <p className="text-caption text-muted-foreground">
      Esta turma reúne estágios diferentes. Filtre um estágio para comparar alunos no mesmo momento
      do curso.
    </p>
  );
}
function PerformanceHeader({
  stages,
  stageId,
  onStageChange,
  children,
}: {
  stages: [string, string][];
  stageId: string;
  onStageChange: (value: string) => void;
  children: ReactNode;
}): ReactElement {
  return (
    <header className={styles.header}>
      <div className={styles.headingRow}>
        <h2 className={styles.heading}>Desempenho da turma</h2>
        <div className={styles.headerControls}>
          {stages.length > 1 && (
            <div className="w-full sm:w-56">
              <SelectControl
                name="performance-stage"
                label="Estágio"
                hideLabel
                value={stageId}
                onChange={onStageChange}
                choices={[
                  { value: "all", label: "Todos os estágios" },
                  ...stages.map(([value, label]) => ({ value, label })),
                ]}
              />
            </div>
          )}
          {children}
        </div>
      </div>
      <p className="text-caption text-muted-foreground">
        Aprendizagem por competência · Alunos com vínculo vigente
      </p>
    </header>
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
