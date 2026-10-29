"use client";
import { useRef, useState, type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Button } from "@lazuli/ui";
import { Plus } from "lucide-react";
import { formatBRLFromCents as money } from "~/lib/format";
import { trpc } from "~/lib/trpc";
import { AddContractMaterial } from "~/features/contracts/add-contract-material";
import { ContractInvoice } from "./contract-invoice";

const ANNUAL_CONTRACT_MONTHS = 12;
type Summary = RouterOutputs["finance"]["studentSummary"];
type Contract = Summary["contracts"][number];

export function FinanceContractTerms({
  summary,
  studentId,
  onPendingChange,
}: {
  summary: Summary;
  studentId: string;
  onPendingChange: (pending: boolean) => void;
}): ReactElement {
  const visible = visibleFinanceContracts(summary);
  const [editingId, setEditingId] = useState<string | null>(null);
  return (
    <div className="grid min-w-0 gap-5">
      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum contrato para exibir.</p>
      )}
      {visible.map((contract) => (
        <ContractDetails
          key={contract.id}
          contract={contract}
          studentId={studentId}
          adding={editingId === contract.id}
          canAdd={editingId === null}
          onAdd={() => setEditingId(contract.id)}
          onClose={() => setEditingId(null)}
          onPendingChange={onPendingChange}
        />
      ))}
    </div>
  );
}

function ContractDetails({
  contract,
  studentId,
  adding,
  canAdd,
  onAdd,
  onClose,
  onPendingChange,
}: {
  contract: Contract;
  studentId: string;
  adding: boolean;
  canAdd: boolean;
  onAdd: () => void;
  onClose: () => void;
  onPendingChange: (pending: boolean) => void;
}): ReactElement {
  const addButton = useRef<HTMLButtonElement>(null);
  const firstDueDate =
    contract.schedules.find((row) => row.kind === "TUITION")?.firstDueDate ?? contract.startsOn;
  function returnToItems(): void {
    onClose();
    requestAnimationFrame(() => addButton.current?.focus());
  }
  return (
    <section className="min-w-0" aria-label={contractLabel(contract)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-heading">
          {adding ? "Adicionar material" : contractLabel(contract)}
        </h3>
        {!adding && contract.hasDetail && firstDueDate && (
          <Button ref={addButton} variant="ghost" size="sm" disabled={!canAdd} onClick={onAdd}>
            <Plus aria-hidden="true" /> Adicionar material
          </Button>
        )}
      </div>
      {!adding && contract.renegotiations?.[0] && (
        <p className="mt-1 text-caption text-muted-foreground">
          Último acordo: {contract.renegotiations[0].installmentCount} parcela(s) a{" "}
          {money(contract.renegotiations[0].newAmountCents)}
        </p>
      )}
      {adding && firstDueDate ? (
        <ContractMaterialEditor
          contract={contract}
          studentId={studentId}
          firstDueDate={firstDueDate}
          onClose={returnToItems}
          onPendingChange={onPendingChange}
        />
      ) : (
        <ContractInvoice contract={contract} />
      )}
    </section>
  );
}

function ContractMaterialEditor({
  contract,
  studentId,
  firstDueDate,
  onClose,
  onPendingChange,
}: {
  contract: Contract;
  studentId: string;
  firstDueDate: string;
  onClose: () => void;
  onPendingChange: (pending: boolean) => void;
}): ReactElement {
  const utils = trpc.useUtils();
  return (
    <AddContractMaterial
      contractId={contract.id}
      studentId={studentId}
      firstDueDate={firstDueDate}
      onClose={onClose}
      onPendingChange={onPendingChange}
      onSaved={() => {
        void utils.finance.studentSummary.invalidate();
        void utils.finance.installments.invalidate();
        void utils.finance.listContracts.invalidate();
      }}
    />
  );
}

function contractLabel(contract: Contract): string {
  if (contract.durationMonths === ANNUAL_CONTRACT_MONTHS) return "Contrato anual";
  if (contract.durationMonths)
    return `Contrato de ${contract.durationMonths} ${contract.durationMonths === 1 ? "mês" : "meses"}`;
  return "Contrato";
}
export function visibleFinanceContracts(summary: Summary): Contract[] {
  const current = summary.contracts.filter(
    (row) =>
      row.startsOn && row.endsOn && row.startsOn <= summary.asOf && row.endsOn >= summary.asOf,
  );
  return current.length > 0 ? current : summary.contracts.slice(0, 1);
}
