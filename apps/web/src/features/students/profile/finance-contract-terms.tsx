"use client";
import { useRef, useState, type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import {
  Button,
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogBackdrop,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@lazuli/ui";
import { ReceiptText, Plus } from "lucide-react";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";
import { trpc } from "~/lib/trpc";
import { AddContractMaterial } from "~/features/contracts/add-contract-material";
import { MaterialPurchaseNotice } from "./material-purchase-reminder";
import { ContractInvoice, paymentTerms, type FinanceSchedule } from "./contract-invoice";
import styles from "./contract-invoice.module.css";

type Summary = RouterOutputs["finance"]["studentSummary"];
type Contract = Summary["contracts"][number];

export function FinanceContractTerms({ summary }: { summary: Summary }): ReactElement | null {
  const visible = visibleFinanceContracts(summary);
  if (visible.length === 0 && summary.materialNeeds.length === 0) return null;
  return (
    <div className="grid min-w-0 gap-3">
      {visible.map((contract) => {
        const tuition = contract.schedules.find((row) => row.kind === "TUITION");
        const materials = contract.schedules.filter((row) => row.kind === "MATERIAL");
        const bookCount = materials.reduce(
          (sum, row) => sum + (row.material?.items.length || 1),
          0,
        );
        return (
          <div key={contract.id} className={styles.summary}>
            <div className={styles.summaryFact}>
              <p className="text-sm font-semibold text-heading">{contractLabel(contract)}</p>
              <p className="text-caption text-muted-foreground">
                <ContractDates contract={contract} />
              </p>
            </div>
            <div className={styles.summaryFact}>
              <span className="text-caption text-muted-foreground">Mensalidade</span>
              <span className="font-numeric text-base font-semibold tabular-nums">
                {tuition ? paymentTerms(tuition) : "—"}
              </span>
            </div>
            <div className={styles.summaryFact}>
              <span className="text-caption text-muted-foreground">
                {bookCount} {bookCount === 1 ? "material" : "materiais"}
              </span>
              <div className="grid justify-items-start gap-1">
                {materials.length > 0
                  ? materials.map((row) => <MaterialTerms key={row.id} item={row} />)
                  : "—"}
              </div>
            </div>
            <ContractItemsDialog contract={contract} />
          </div>
        );
      })}
      <MaterialPurchaseNotice needs={summary.materialNeeds} />
    </div>
  );
}

function MaterialTerms({ item }: { item: FinanceSchedule }): ReactElement {
  const material = item.material;
  const card = material?.payment === "INSTALLMENTS";
  const terms =
    material?.chargedAmountCents == null
      ? paymentTerms(item)
      : `${card ? material.quotedInstallments : 1}× de ${money(card ? material.quotedInstallmentCents : material.chargedAmountCents)}`;
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={`Condição do material: ${terms}`}
        className="cursor-help font-numeric text-base font-semibold tabular-nums underline decoration-dotted decoration-border-strong underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
      >
        {terms}
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-semibold">{item.materialName ?? "Material didático"}</p>
        <p>
          {card
            ? "O parcelamento é feito pelo cartão. A escola recebe o valor líquido integral em um único repasse, em até 24h após a venda."
            : "Pagamento à vista, em um único recebimento para a escola."}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

function ContractItemsDialog({ contract }: { contract: Contract }): ReactElement {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const utils = trpc.useUtils();
  const firstDueDate = contract.schedules.find((row) => row.kind === "TUITION")?.firstDueDate;
  function returnToItems(): void {
    setAdding(false);
    requestAnimationFrame(() => requestAnimationFrame(() => addButton.current?.focus()));
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next, event) => {
        if (!next && pending) {
          event.cancel();
          return;
        }
        if (!next && adding && event.reason === "escape-key") {
          event.cancel();
          returnToItems();
          return;
        }
        setOpen(next);
        if (!next) setAdding(false);
      }}
    >
      <DialogTrigger render={<Button variant="secondary" size="sm" />}>
        <ReceiptText aria-hidden="true" /> Ver contrato
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className="md:w-[calc(100vw-3rem)] md:max-w-[47.6rem]"
          showCloseButton={!pending}
        >
          <DialogHeader>
            <DialogTitle>{adding ? "Adicionar material" : contractLabel(contract)}</DialogTitle>
            <DialogDescription>
              {contract.studentName}
              {adding ? " · Escolha os livros e confira o recebimento" : " · Itens e recebimentos"}
            </DialogDescription>
          </DialogHeader>
          {adding && firstDueDate ? (
            <AddContractMaterial
              contractId={contract.id}
              firstDueDate={firstDueDate}
              onClose={returnToItems}
              onPendingChange={setPending}
              onSaved={() => {
                void utils.finance.studentSummary.invalidate();
                void utils.finance.installments.invalidate();
                void utils.finance.listContracts.invalidate();
              }}
            />
          ) : (
            <>
              <DialogBody>
                <ContractInvoice contract={contract} />
              </DialogBody>
              <DialogFooter>
                <DialogClose render={<Button variant="ghost" size="sm" />}>Fechar</DialogClose>
                {contract.hasDetail && firstDueDate && (
                  <Button
                    ref={addButton}
                    variant="secondary"
                    size="sm"
                    onClick={() => setAdding(true)}
                  >
                    <Plus aria-hidden="true" /> Adicionar material
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function ContractDates({ contract }: { contract: Contract }): ReactElement {
  const tuition = contract.schedules.find((row) => row.kind === "TUITION");
  return (
    <>
      {contract.startsOn && contract.endsOn && (
        <>
          {formatDateOnlyBR(contract.startsOn)} a {formatDateOnlyBR(contract.endsOn)}
        </>
      )}
      {tuition && <> · vencimento dia {tuition.dueDay}</>}
    </>
  );
}
function contractLabel(contract: Contract): string {
  if (contract.durationMonths === 12) return "Contrato anual";
  if (contract.durationMonths) return `Contrato de ${contract.durationMonths} meses`;
  return "Contrato";
}
export function visibleFinanceContracts(summary: Summary): Contract[] {
  const current = summary.contracts.filter(
    (row) =>
      row.startsOn && row.endsOn && row.startsOn <= summary.asOf && row.endsOn >= summary.asOf,
  );
  return current.length > 0 ? current : summary.contracts.slice(0, 1);
}
