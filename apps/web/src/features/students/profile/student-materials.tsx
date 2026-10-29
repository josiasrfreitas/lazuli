"use client";

import { useState, type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import {
  Alert,
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  InlineSkeleton,
  type DataTableColumn,
} from "@lazuli/ui";
import { BookOpen, Plus } from "lucide-react";
import { trpc } from "~/lib/trpc";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";
import { AddContractMaterial } from "~/features/contracts/add-contract-material";
import { materialPaymentLabel } from "~/features/contracts/material-payment-label";
import { visibleFinanceContracts } from "./finance-contract-terms";
import styles from "./student-materials.module.css";

type Summary = RouterOutputs["finance"]["studentSummary"];
type Materials = RouterOutputs["finance"]["studentMaterials"];
type Acquisition = Materials["acquisitions"][number];

export function StudentMaterials({
  studentId,
  studentName,
  summary,
}: {
  studentId: string;
  studentName: string;
  summary: Summary;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(false);
  const query = trpc.finance.studentMaterials.useQuery({ studentId }, { enabled: open });
  const utils = trpc.useUtils();
  const contract = visibleFinanceContracts(summary).find((row) => row.hasDetail);
  const dueDate =
    contract?.schedules.find((row) => row.kind === "TUITION")?.firstDueDate ?? contract?.startsOn;
  return (
    <Dialog
      open={open}
      onOpenChange={(next, event) => {
        if (!next && pending) {
          event.cancel();
          return;
        }
        setOpen(next);
        if (!next) setAdding(false);
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="secondary" />}>
        <BookOpen aria-hidden="true" /> Material didático
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop className={styles.backdrop} />
        <DialogContent
          className={[styles.dialog, "md:w-[calc(100vw-3rem)] md:max-w-5xl"].join(" ")}
          showCloseButton={!pending}
        >
          <DialogHeader>
            <DialogTitle>{adding ? "Adquirir material" : "Material didático"}</DialogTitle>
            <DialogDescription>{studentName}</DialogDescription>
          </DialogHeader>
          {adding && contract && dueDate ? (
            <AddContractMaterial
              contractId={contract.id}
              firstDueDate={dueDate}
              studentId={studentId}
              suggestedStageId={query.data?.suggestedStageId ?? null}
              onPendingChange={setPending}
              onClose={() => setAdding(false)}
              onSaved={() => {
                void utils.finance.invalidate();
              }}
            />
          ) : (
            <>
              <DialogBody>
                <div className={styles.body}>
                  {query.isError ? (
                    <Alert variant="destructive">
                      Não foi possível carregar os materiais.{" "}
                      <Button variant="link" size="inline" onClick={() => void query.refetch()}>
                        Tentar novamente
                      </Button>
                    </Alert>
                  ) : query.data ? (
                    <MaterialDetails data={query.data} />
                  ) : (
                    <MaterialLoading />
                  )}
                </div>
              </DialogBody>
              <DialogFooter>
                <DialogClose render={<Button variant="secondary" size="sm" />}>Fechar</DialogClose>
                {contract && dueDate && (
                  <Button size="sm" onClick={() => setAdding(true)} disabled={!query.data}>
                    <Plus aria-hidden="true" /> Adquirir material
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

function MaterialDetails({ data }: { data: Materials }): ReactElement {
  return (
    <>
      <dl className={styles.coverage}>
        <div>
          <dt>Material atual</dt>
          <dd>
            {data.current.length === 0 ? (
              <span className={styles.empty}>Estágio a definir</span>
            ) : (
              data.current.map((book) => (
                <div key={book.id} className={styles.book}>
                  <strong>{book.name}</strong>
                  <Badge variant={book.acquired ? "success" : "warning"}>
                    {book.acquired ? "Adquirido" : "Precisa adquirir"}
                  </Badge>
                </div>
              ))
            )}
          </dd>
          {data.next
            .filter((book) => book.acquired)
            .map((book) => (
              <dd key={book.id} className={styles.note}>
                {book.name} também já adquirido
              </dd>
            ))}
        </div>
        <div>
          <dt>Próxima aquisição</dt>
          {data.nextAcquisitions.length === 0 ? (
            <dd className={styles.empty}>
              {data.current.length > 0
                ? "Nenhum material pendente"
                : "Defina o estágio para consultar"}
            </dd>
          ) : (
            data.nextAcquisitions.map((book) => (
              <dd key={book.id}>
                <strong>{book.name}</strong>
                <p className={styles.note}>
                  {book.source === "CURRENT"
                    ? "Para o estágio atual"
                    : book.neededOn
                      ? "Previsto para " + formatDateOnlyBR(book.neededOn)
                      : book.source === "PLANNED"
                        ? "Próximo estágio definido"
                        : "Sugestão pela sequência do curso"}
                </p>
              </dd>
            ))
          )}
        </div>
      </dl>
      <section className={styles.history} aria-labelledby="material-acquisitions-heading">
        <div className={styles.historyHeading}>
          <h3 id="material-acquisitions-heading">Aquisições</h3>
          <span>
            {data.acquiredCount}{" "}
            {data.acquiredCount === 1 ? "livro adquirido" : "livros adquiridos"}
          </span>
        </div>
        <DataTable
          label="Aquisições de material"
          columns={acquisitionColumns}
          state={
            data.acquisitions.length > 0
              ? { kind: "data", rows: data.acquisitions }
              : { kind: "empty" }
          }
          empty={{
            title: "Nenhum material adquirido",
            description: "Registre os livros e as condições combinadas em Adquirir material.",
          }}
        />
      </section>
    </>
  );
}

const acquisitionColumns: DataTableColumn<Acquisition>[] = [
  {
    id: "books",
    header: "Livros",
    width: "wide",
    cell: (sale) => (
      <div className="grid gap-1">
        <span className="font-medium">{sale.books.map((book) => book.name).join(" + ")}</span>
        <span className="text-caption text-muted-foreground">
          {formatDateOnlyBR(sale.acquiredOn)}
        </span>
      </div>
    ),
  },
  {
    id: "total",
    header: "Valor cobrado",
    width: "standard",
    numeric: true,
    cell: (sale) => <span className="font-numeric">{money(sale.chargedCents)}</span>,
  },
  {
    id: "terms",
    header: "Pagamento do aluno",
    width: "wide",
    cell: (sale) => (
      <div className="grid gap-1">
        <span>
          {sale.chargedCents === 0
            ? "Bolsa integral"
            : sale.payment === "CASH"
              ? "À vista"
              : sale.installmentCount === 1
                ? "Cartão · à vista"
                : materialPaymentLabel(sale.chargedCents, sale.installmentCount)}
        </span>
        {sale.payment === "INSTALLMENTS" && sale.installmentCount > 1 && (
          <span className="text-caption text-muted-foreground">Parcelado por terceiros</span>
        )}
      </div>
    ),
  },
];

function MaterialLoading(): ReactElement {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Carregando materiais">
      <div className={styles.coverage} aria-hidden="true">
        {[0, 1].map((id) => (
          <div key={id} className="grid gap-2">
            <InlineSkeleton className="h-3 w-28" />
            <InlineSkeleton className="h-6 w-48 max-w-full" />
            <InlineSkeleton className="h-3 w-40 max-w-full" />
          </div>
        ))}
      </div>
      <div className={styles.history}>
        <InlineSkeleton className="h-5 w-28" aria-hidden="true" />
        <DataTable
          label="Carregando aquisições"
          columns={acquisitionColumns}
          state={{ kind: "loading" }}
          loadingRows={1}
        />
      </div>
    </div>
  );
}
