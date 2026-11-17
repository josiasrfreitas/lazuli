"use client";
import { useQueryState } from "nuqs";
import { useState, type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import type { FinanceInstallmentRow } from "@lazuli/validators";
import {
  ToastAlert,
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  InlineSkeleton,
} from "@lazuli/ui";
import { BookOpen, CheckCircle2, Wallet } from "lucide-react";
import { trpc } from "~/lib/trpc";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";
import { PaymentDialog } from "~/features/installments/payment/payment-dialog";
import { visibleFinanceContracts } from "./finance-contract-terms";
import { MaterialReceipt, type MaterialTarget } from "./material-receipt";
import styles from "./student-materials.module.css";

type Summary = RouterOutputs["finance"]["studentSummary"];
type Materials = RouterOutputs["finance"]["studentMaterials"];
type Sale = Materials["acquisitions"][number];

export function StudentMaterials({
  studentId,
  studentName,
  summary,
}: {
  studentId: string;
  studentName: string;
  summary: Summary;
}): ReactElement {
  const [requested, setRequested] = useQueryState("material");
  const open = requested === "1";
  const [target, setTarget] = useState<MaterialTarget | null>(null);
  const [rows, setRows] = useState<FinanceInstallmentRow[]>([]);
  const [pending, setPending] = useState(false);
  const query = trpc.finance.studentMaterials.useQuery({ studentId }, { enabled: open });
  const utils = trpc.useUtils();
  const contract = visibleFinanceContracts(summary).find((row) => row.hasDetail);
  function saved() {
    void Promise.all([
      utils.finance.invalidate(),
      utils.students.invalidate(),
      utils.dashboard.invalidate(),
    ]);
    setTarget(null);
    setRows([]);
  }
  return (
    <>
      <Dialog
        open={open && !rows.length}
        onOpenChange={(next, event) => {
          if (pending) {
            event.cancel();
            return;
          }
          if (!next) {
            void setRequested(null);
            setTarget(null);
          }
        }}
      >
        <DialogPortal>
          <div className={styles.dialogScope}>
            <DialogBackdrop data-student-materials-backdrop="" />
            <DialogContent
              data-student-materials-dialog=""
              showCloseButton={!pending}
              finalFocus={() =>
                rows.length ? null : document.getElementById("student-finance-actions")
              }
            >
              <DialogHeader>
                <DialogTitle>{target ? "Pagamento do material" : "Material didático"}</DialogTitle>
                <DialogDescription>{studentName}</DialogDescription>
              </DialogHeader>
              {target ? (
                <MaterialReceipt
                  target={target}
                  onBack={() => setTarget(null)}
                  onPending={setPending}
                  onSaved={saved}
                />
              ) : (
                <DialogBody>
                  <div className={styles.body}>
                    {query.isError ? (
                      <ToastAlert variant="destructive">
                        Falha ao carregar os livros.{" "}
                        <Button variant="link" onClick={() => void query.refetch()}>
                          Tentar novamente
                        </Button>
                      </ToastAlert>
                    ) : query.data ? (
                      <BookList
                        data={query.data}
                        onPay={setTarget}
                        onReceive={setRows}
                        contractId={contract?.id}
                      />
                    ) : (
                      <InlineSkeleton className="h-24 w-full" aria-label="Carregando livros" />
                    )}
                  </div>
                </DialogBody>
              )}
            </DialogContent>
          </div>
        </DialogPortal>
      </Dialog>
      {open && rows.length > 0 && (
        <PaymentDialog
          open
          rows={rows}
          onOpenChange={(next) => {
            if (!next) setRows([]);
          }}
          onRegistered={saved}
        />
      )}
    </>
  );
}

function BookList({
  data,
  onPay,
  onReceive,
  contractId,
}: {
  data: Materials;
  onPay: (target: MaterialTarget) => void;
  onReceive: (rows: FinanceInstallmentRow[]) => void;
  contractId: string | undefined;
}) {
  const shownOrders = new Set<string>();
  const saleFor = (contractId: string, stageId: string | null) =>
    data.acquisitions.find(
      (sale) =>
        sale.contractId === contractId && sale.books.some((book) => book.stageId === stageId),
    );
  function receiptAction(name: string, action: () => void) {
    return (
      <Button
        size="sm"
        variant="secondary"
        aria-label={`Registrar pagamento de ${name}`}
        onClick={action}
      >
        <Wallet aria-hidden />
        Registrar pagamento
      </Button>
    );
  }
  function payment(sale: Sale) {
    const rows = data.openMaterialRows.filter((row) => row.orderId === sale.id);
    if (rows.length)
      return (
        <>
          <div className={styles.payment}>
            <strong>{money(sale.balanceCents)}</strong>
            <span>A pagar</span>
          </div>
          {receiptAction(sale.books.map((b) => b.name).join(" + "), () => onReceive(rows))}
        </>
      );
    return (
      <div className={styles.settled}>
        <strong>
          {sale.lastReceipt && <CheckCircle2 aria-hidden />}
          {sale.chargedCents ? money(sale.chargedCents) : "Bolsa integral"}
        </strong>
        {sale.lastReceipt ? (
          <span>
            Pago em {formatDateOnlyBR(sale.lastReceipt.date)} · {sale.lastReceipt.method}
          </span>
        ) : (
          sale.chargedCents > 0 && (
            <span>{sale.balanceCents > 0 ? "A pagar" : "Sem saldo a receber"}</span>
          )
        )}
      </div>
    );
  }
  const slots = data.plannedBooks.map((book) => {
    const sale = saleFor(book.contractId, book.stageId);
    if (sale) shownOrders.add(sale.id);
    const name = book.name ?? "Livro a definir";
    return (
      <li key={book.contractId + book.semester}>
        <div className={styles.identity}>
          <strong>{name}</strong>
          <span>{book.semester}º semestre</span>
        </div>
        {sale ? (
          payment(sale)
        ) : (
          <>
            <div className={styles.payment}>
              {book.agreedPriceCents && <strong>{money(book.agreedPriceCents)}</strong>}
              <span>
                {book.acquisitionSemester
                  ? `Pagamento no ${book.acquisitionSemester}º semestre`
                  : "Pagamento sem data definida"}
              </span>
            </div>
            {receiptAction(name, () => onPay(book))}
          </>
        )}
      </li>
    );
  });
  const history = data.acquisitions.filter((sale) => !shownOrders.has(sale.id));
  const hasSlots = data.plannedBooks.some((book) => book.contractId === contractId);
  return (
    <>
      {data.current.length > 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="size-4" aria-hidden /> Em uso ·{" "}
          {data.current.map((book) => book.name).join(", ")}
        </p>
      )}
      {slots.length > 0 && (
        <section>
          <h3>Livros do contrato</h3>
          <ul className={styles.books}>{slots}</ul>
        </section>
      )}
      {history.length > 0 && (
        <section>
          <h3>Outros materiais</h3>
          <ul className={styles.books}>
            {history.map((sale) => (
              <li key={sale.id}>
                <div className={styles.identity}>
                  <strong>{sale.books.map((book) => book.name).join(" + ")}</strong>
                </div>
                {payment(sale)}
              </li>
            ))}
          </ul>
        </section>
      )}
      {!slots.length && !history.length && <p>Nenhum livro registrado.</p>}
      {contractId && !hasSlots && (
        <Button
          size="sm"
          variant="secondary"
          className="justify-self-start"
          onClick={() => onPay({ contractId, stageId: null })}
        >
          Registrar pagamento de livro
        </Button>
      )}
    </>
  );
}
