"use client";
import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Button, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatBRLFromCents as money, formatDateOnlyBR as date } from "~/lib/format";
import { originLabel } from "~/features/installments/view-model";

const DATE_LENGTH = 10;
type HistoryRow = RouterOutputs["finance"]["treatmentHistory"][number];
const agreementDate = (value: Date): string => date(value.toISOString().slice(0, DATE_LENGTH));
export function StudentTreatments({ studentId }: { studentId: string }): ReactElement {
  const history = trpc.finance.treatmentHistory.useQuery({ studentId }, { staleTime: 0 });
  return (
    <section className="grid gap-3 border-t border-border pt-4" aria-label="Tratativas financeiras">
      <h2 className="font-display text-xl font-semibold text-heading">Histórico de tratativas</h2>
      {history.isPending && (
        <div role="status" aria-label="Carregando tratativas">
          <InlineSkeleton className="h-4 w-48 max-w-full" />
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
      {history.data && (
        <ul className="grid gap-3">
          {history.data.map((row) => (
            <HistoryItem key={row.id} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}
function HistoryItem({ row }: { row: HistoryRow }): ReactElement {
  return (
    <li className="grid gap-1 border-b border-border pb-3">
      <p className="font-medium">
        {originLabel(row.installment.order.kind)} · parcela {row.installment.sequenceNumber}
      </p>
      {row.newDueDate && (
        <p>
          Suspensão: {agreementDate(row.effectiveDate)} a {agreementDate(row.newDueDate)}.
          Vencimento: {agreementDate(row.previousDueDate)} → {agreementDate(row.newDueDate)}.
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
        {row.actorName} · {agreementDate(row.effectiveDate)}
      </p>
    </li>
  );
}
