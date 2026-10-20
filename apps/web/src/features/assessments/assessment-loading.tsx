import { InlineSkeleton } from "@lazuli/ui";
import { AssessmentResults } from "./results-table";

function ChartLoading({ columns = 2 }: { columns?: number }) {
  return (
    <div className="grid min-w-0 gap-3" aria-hidden="true">
      <div className="flex h-60 flex-col justify-between border-b border-l border-border p-4">
        {[0, 1, 2, 3].map((row) => (
          <InlineSkeleton key={row} className="h-px w-full rounded-none" />
        ))}
      </div>
      <div className="flex justify-around gap-3">
        {Array.from({ length: columns }, (_, column) => (
          <InlineSkeleton key={column} className="h-3 w-12 min-w-0 shrink rounded-sm" />
        ))}
      </div>
    </div>
  );
}

export function AssessmentLoading({ heading = false }: { heading?: boolean }) {
  return (
    <div
      role="status"
      aria-label="Carregando avaliações"
      aria-busy="true"
      className="grid w-full min-w-0 gap-3"
    >
      <span className="sr-only">Carregando avaliações…</span>
      {heading && (
        <div className="grid gap-2" aria-hidden="true">
          <InlineSkeleton className="h-4 w-32 rounded-sm" />
          <InlineSkeleton className="h-3 w-48 max-w-full rounded-sm" />
        </div>
      )}
      <InlineSkeleton className="h-3 w-64 max-w-full rounded-sm" aria-hidden="true" />
      <div className="min-w-0" aria-hidden="true">
        <AssessmentResults />
      </div>
      <InlineSkeleton className="h-3 w-24 rounded-sm" />
      <InlineSkeleton className="h-3 w-36 rounded-sm" />
    </div>
  );
}

export function ClassPerformanceLoading() {
  return (
    <section
      className="grid min-w-0 shrink-0 gap-3 rounded-lg border border-border bg-card p-3 sm:p-4"
      role="status"
      aria-label="Carregando desempenho da turma"
      aria-busy="true"
    >
      <span className="sr-only">Carregando desempenho da turma…</span>
      <div>
        <h2 className="text-sm font-semibold">Desempenho da turma</h2>
        <p className="mt-1 text-caption text-muted-foreground">
          Aprendizagem por competência · Alunos com vínculo vigente
        </p>
      </div>
      <div
        className="grid grid-cols-3 divide-x divide-border border-y border-border py-2"
        aria-hidden="true"
      >
        {[0, 1, 2].map((item) => (
          <div key={item} className={item ? "grid gap-2 px-3 sm:px-5" : "grid gap-2 pr-3 sm:pr-5"}>
            <InlineSkeleton className="h-5 w-6 rounded-sm" />
            <InlineSkeleton className="h-3 w-24 max-w-full rounded-sm" />
          </div>
        ))}
      </div>
      <ChartLoading columns={4} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden="true">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="grid gap-2">
            <InlineSkeleton className="h-3 w-28 max-w-full rounded-sm" />
            <InlineSkeleton className="h-4 w-6 rounded-sm" />
          </div>
        ))}
      </div>
      <div className="grid w-full gap-2 sm:max-w-sm" aria-hidden="true">
        <InlineSkeleton className="h-3 w-48 max-w-full rounded-sm" />
        <InlineSkeleton className="h-8 w-full rounded-sm" />
      </div>
    </section>
  );
}
