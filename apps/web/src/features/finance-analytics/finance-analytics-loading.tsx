import type { ReactElement } from "react";
import { InlineSkeleton } from "@lazuli/ui";

const SKELETON_ROW_COUNT = 4;

export function AnalyticsLoading(): ReactElement {
  return (
    <div aria-label="Carregando indicadores financeiros" aria-busy="true" className="space-y-5">
      <div
        className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-5 xl:grid-cols-4"
        aria-hidden="true"
      >
        {Array.from({ length: SKELETON_ROW_COUNT }, (_unused, index) => index).map((index) => (
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
          Recebimentos, cobranças e mensalidades por turma.
        </p>
      </header>
      <AnalyticsLoading />
    </div>
  );
}
