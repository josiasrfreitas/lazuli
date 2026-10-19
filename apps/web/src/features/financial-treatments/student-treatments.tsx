"use client";
import { Button, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatBRLFromCents as money, formatDateOnlyBR as date } from "~/lib/format";
import { originLabel } from "~/features/installments/view-model";
export function StudentTreatments({ studentId }: { studentId: string }) {
  const history = trpc.finance.treatmentHistory.useQuery({ studentId });
  return (
    <section className="grid gap-3 border-t border-border pt-4" aria-label="Tratativas financeiras">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-heading">Histórico de tratativas</h2>
      </div>
      {history.isPending && (
        <div role="status" aria-label="Carregando tratativas" className="grid gap-3">
          {[0, 1, 2].map((row) => (
            <div key={row} className="grid gap-2 border-b border-border pb-3" aria-hidden="true">
              <InlineSkeleton className="h-4 w-48 max-w-full" />
              <InlineSkeleton className="h-3 w-64 max-w-full" />
              <InlineSkeleton className="h-3 w-32 max-w-full" />
            </div>
          ))}
        </div>
      )}
      {history.isError && (
        <div role="alert">
          Não foi possível carregar as tratativas.{" "}
          <Button variant="link" size="inline" onClick={() => void history.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {history.data?.length === 0 && (
        <p className="text-caption text-muted-foreground">
          Nenhuma negociação ou suspensão registrada.
        </p>
      )}
      {history.data && history.data.length > 0 && (
        <ul className="grid gap-3">
          {history.data.map((row) => (
            <li key={row.id} className="grid gap-1 border-b border-border pb-3">
              <p className="font-medium">
                {originLabel(row.installment.order.kind)} · parcela {row.installment.sequenceNumber}
              </p>
              {row.newDueDate && (
                <p>
                  Suspensão: {date(row.effectiveDate.toISOString().slice(0, 10))} a{" "}
                  {date(row.newDueDate.toISOString().slice(0, 10))}. Vencimento:{" "}
                  {date(row.previousDueDate.toISOString().slice(0, 10))} →{" "}
                  {date(row.newDueDate.toISOString().slice(0, 10))}.
                </p>
              )}
              {row.reductionCents > 0 && (
                <p>
                  Encargos: {money(row.previousChargesCents)} →{" "}
                  {money(row.previousChargesCents - row.reductionCents)}.
                </p>
              )}
              <p className="whitespace-pre-wrap break-words">{row.reason}</p>
              <p className="text-caption text-muted-foreground">
                {row.actorName} · {date(row.effectiveDate.toISOString().slice(0, 10))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
