import type { ReactElement } from "react";
import { InlineSkeleton, PencilLoader } from "@lazuli/ui";

export function AnalyticsLoading(): ReactElement {
  return (
    <div aria-label="Carregando indicadores financeiros" aria-busy="true" className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-heading">Volume contratado</h2>
        <p className="mt-1 text-caption text-muted-foreground">
          Pelo mês de fechamento · prazo completo de cada contrato.
        </p>
        <div className="my-5 grid grid-cols-2 gap-5 border-y border-border py-4 sm:grid-cols-3">
          {["Volume contratado", "Contratos fechados", "Variação mensal"].map((label) => (
            <div key={label} className="space-y-2">
              <p className="text-caption text-muted-foreground">{label}</p>
              <InlineSkeleton className="h-7 w-28" />
            </div>
          ))}
        </div>
        <div className="flex h-80 items-center justify-center">
          <PencilLoader label="Carregando volume contratado" />
        </div>
      </section>
      <div
        className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-5 xl:grid-cols-4"
        aria-hidden="true"
      >
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="grid gap-3">
            <InlineSkeleton className="w-24" />
            <InlineSkeleton className="h-7 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FinanceAnalyticsLoading(): ReactElement {
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-heading">Visão financeira</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contratos, recebimentos e valores em atraso.
        </p>
      </header>
      <AnalyticsLoading />
    </div>
  );
}
