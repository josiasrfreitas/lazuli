"use client";

import { useState, type ReactElement } from "react";
import { Download, Paperclip } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import {
  Badge,
  Button,
  InlineSkeleton,
  ToastAlert,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";
import { InstallmentProofDialog } from "~/features/installments/installment-proof-dialog";
import { installmentStatusBadge } from "~/features/installments/view-model";
import styles from "./contract-installments.module.css";

type Installment = RouterOutputs["finance"]["contractInstallments"]["rows"][number];
const LOADING_ROWS = ["first", "second", "third", "fourth"];

export function ContractInstallments({
  orderId,
  payerName,
}: {
  orderId: string;
  payerName: string;
}): ReactElement {
  const query = trpc.finance.contractInstallments.useQuery({ orderId });
  const [proofInstallment, setProofInstallment] = useState<string | null>(null);
  if (query.isPending) return <InstallmentsLoading />;
  if (!query.data)
    return (
      <ToastAlert variant="destructive">
        Não foi possível carregar as parcelas.
        <Button variant="link" size="sm" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      </ToastAlert>
    );
  return (
    <div className={styles.container}>
      <TooltipProvider>
        <div
          className={`${styles.scrollRegion} scrollbar-subtle`}
          tabIndex={0}
          role="region"
          aria-label="Rolagem das parcelas"
        >
          <table className={styles.table} aria-label="Parcelas das mensalidades">
            <thead>
              <tr>
                <th scope="col">Parcela · vencimento</th>
                <th scope="col">Situação</th>
                <th scope="col">Valor da parcela</th>
                <th scope="col">
                  <span className="sr-only">Comprovante</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {query.data.rows.map((row) => (
                <InstallmentRow
                  key={row.installmentId}
                  row={row}
                  asOf={query.data.asOf}
                  onProof={() => setProofInstallment(row.installmentId)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </TooltipProvider>
      {query.data.rows.length === 0 && <p>Nenhuma parcela emitida.</p>}
      {proofInstallment && (
        <InstallmentProofDialog
          installmentId={proofInstallment}
          payerName={payerName}
          onClose={() => setProofInstallment(null)}
        />
      )}
    </div>
  );
}

function InstallmentRow({
  row,
  asOf,
  onProof,
}: {
  row: Installment;
  asOf: string;
  onProof: () => void;
}): ReactElement {
  const badge = installmentStatusBadge(row, asOf);
  const partial = row.paidAmountCents > 0 && row.collectibleBalanceCents > 0;
  return (
    <tr>
      <td>
        <div className={styles.due}>
          <span className={styles.sequence} aria-label={`Parcela ${row.sequenceNumber}`}>
            {String(row.sequenceNumber).padStart(2, "0")}
          </span>
          <time dateTime={row.dueDate}>{formatDateOnlyBR(row.dueDate)}</time>
        </div>
      </td>
      <td>
        <Badge variant={badge.variant} title={badge.description}>
          {badge.variant === "destructive" ? "Em atraso" : badge.label}
        </Badge>
      </td>
      <td className={styles.amount}>
        {money(row.expectedAmountCents)}
        {partial && <small>Recebido {money(row.paidAmountCents)}</small>}
      </td>
      <td className={styles.action}>
        <ProofAction row={row} onProof={onProof} />
      </td>
    </tr>
  );
}

function ProofAction({ row, onProof }: { row: Installment; onProof: () => void }): ReactElement {
  const proof = row.proofs.length === 1 ? row.proofs[0] : undefined;
  const label = row.proofs.length > 0 ? "Baixar comprovante" : "Anexar comprovante";
  const identity = `${label} da parcela ${row.sequenceNumber}`;
  const Icon = row.proofs.length > 0 ? Download : Paperclip;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={row.hasPayments ? undefined : 0}
            aria-label={
              row.hasPayments ? undefined : "Comprovante disponível após registrar um recebimento"
            }
          />
        }
      >
        <Button
          variant="ghost"
          size="icon-compact-responsive"
          aria-label={identity}
          disabled={!row.hasPayments}
          nativeButton={!proof}
          render={proof ? <a href={`/api/payment-proofs/${proof.id}`} /> : undefined}
          onClick={proof ? undefined : onProof}
        >
          <Icon aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {row.hasPayments ? label : "Disponível após registrar um recebimento"}
      </TooltipContent>
    </Tooltip>
  );
}

function InstallmentsLoading(): ReactElement {
  return (
    <div className={styles.loading} role="status" aria-label="Carregando parcelas">
      {LOADING_ROWS.map((row) => (
        <div key={row}>
          <InlineSkeleton className="h-3 w-24" />
          <InlineSkeleton className="h-4 w-16" />
          <InlineSkeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
