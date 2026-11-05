"use client";

import { useState, type ComponentProps, type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import {
  ToastAlert,
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
    <Dialog open={open} onOpenChange={materialOpenChange({ pending, setOpen, setAdding })}>
      <DialogTrigger render={<Button size="sm" variant="secondary" />}>
        <BookOpen aria-hidden="true" /> Material didático
      </DialogTrigger>
      <DialogPortal>
        <div className={styles.dialogScope}>
          <DialogBackdrop data-student-materials-backdrop="" />
          <DialogContent data-student-materials-dialog="" showCloseButton={!pending}>
            <MaterialContents
              studentId={studentId}
              studentName={studentName}
              adding={adding}
              contract={contract}
              dueDate={dueDate}
              data={query.data}
              error={query.isError}
              onRetry={() => void query.refetch()}
              onPendingChange={setPending}
              onAddingChange={setAdding}
              onSaved={() => void utils.finance.invalidate()}
            />
          </DialogContent>
        </div>
      </DialogPortal>
    </Dialog>
  );
}

function materialOpenChange(input: {
  pending: boolean;
  setOpen: (open: boolean) => void;
  setAdding: (adding: boolean) => void;
}): NonNullable<ComponentProps<typeof Dialog>["onOpenChange"]> {
  return (next, event) => {
    if (!next && input.pending) {
      event.cancel();
      return;
    }
    input.setOpen(next);
    if (!next) input.setAdding(false);
  };
}

type MaterialContentsProps = {
  studentId: string;
  studentName: string;
  adding: boolean;
  contract: ReturnType<typeof visibleFinanceContracts>[number] | undefined;
  dueDate: string | null | undefined;
  data: Materials | undefined;
  error: boolean;
  onRetry: () => void;
  onPendingChange: (pending: boolean) => void;
  onAddingChange: (adding: boolean) => void;
  onSaved: () => void;
};

function MaterialContents(props: MaterialContentsProps): ReactElement {
  const { adding, contract, dueDate, studentId, studentName, data } = props;
  return (
    <>
      <DialogHeader>
        <DialogTitle>{adding ? "Adquirir material" : "Material didático"}</DialogTitle>
        <DialogDescription>{studentName}</DialogDescription>
      </DialogHeader>
      {adding && contract && dueDate ? (
        <AddContractMaterial
          contractId={contract.id}
          firstDueDate={dueDate}
          studentId={studentId}
          suggestedStageId={data?.suggestedStageId ?? null}
          onPendingChange={props.onPendingChange}
          onClose={() => props.onAddingChange(false)}
          onSaved={props.onSaved}
        />
      ) : (
        <MaterialList {...props} />
      )}
    </>
  );
}

function MaterialList(props: MaterialContentsProps): ReactElement {
  const { contract, dueDate, data, error, onRetry, onAddingChange } = props;
  return (
    <>
      <DialogBody>
        <div className={styles.body}>
          <MaterialQueryState data={data} error={error} onRetry={onRetry} />
        </div>
      </DialogBody>
      <DialogFooter>
        <DialogClose render={<Button variant="secondary" size="sm" />}>Fechar</DialogClose>
        {contract && dueDate && (
          <Button size="sm" onClick={() => onAddingChange(true)} disabled={!data}>
            <Plus aria-hidden="true" /> Adquirir material
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

function MaterialQueryState({
  data,
  error,
  onRetry,
}: {
  data: Materials | undefined;
  error: boolean;
  onRetry: () => void;
}): ReactElement {
  if (error)
    return (
      <ToastAlert variant="destructive">
        Não foi possível carregar os materiais.{" "}
        <Button variant="link" size="inline" onClick={onRetry}>
          Tentar novamente
        </Button>
      </ToastAlert>
    );
  return data ? <MaterialDetails data={data} /> : <MaterialLoading />;
}

function MaterialDetails({ data }: { data: Materials }): ReactElement {
  return (
    <>
      <dl className={styles.coverage}>
        <CurrentMaterial data={data} />
        <NextMaterial data={data} />
      </dl>
      <section className={styles.history} aria-labelledby="material-acquisitions-heading">
        <div className={styles.historyHeading}>
          <h3 id="material-acquisitions-heading">Aquisições</h3>
          <span>
            {data.acquiredCount}{" "}
            {data.acquiredCount === 1 ? "livro adquirido" : "livros adquiridos"}
          </span>
        </div>
        <AcquisitionTable acquisitions={data.acquisitions} />
      </section>
    </>
  );
}

function CurrentMaterial({ data }: { data: Materials }): ReactElement {
  return (
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
  );
}

function nextMaterialNote(book: Materials["nextAcquisitions"][number]): string {
  if (book.source === "CURRENT") return "Para o estágio atual";
  if (book.neededOn) return "Previsto para " + formatDateOnlyBR(book.neededOn);
  if (book.source === "PLANNED") return "Próximo estágio definido";
  return "Sugestão pela sequência do curso";
}

function NextMaterial({ data }: { data: Materials }): ReactElement {
  return (
    <div>
      <dt>Próxima aquisição</dt>
      {data.nextAcquisitions.length === 0 ? (
        <dd className={styles.empty}>
          {data.current.length > 0 ? "Nenhum material pendente" : "Defina o estágio para consultar"}
        </dd>
      ) : (
        data.nextAcquisitions.map((book) => (
          <dd key={book.id}>
            <strong>{book.name}</strong>
            <p className={styles.note}>{nextMaterialNote(book)}</p>
          </dd>
        ))
      )}
    </div>
  );
}

function AcquisitionTable({ acquisitions }: { acquisitions: Acquisition[] }): ReactElement {
  return (
    <DataTable
      label="Aquisições de material"
      columns={acquisitionColumns}
      state={acquisitions.length > 0 ? { kind: "data", rows: acquisitions } : { kind: "empty" }}
      empty={{
        title: "Nenhum material adquirido",
        description: "Registre os livros e as condições combinadas em Adquirir material.",
      }}
      errorTitle="Não foi possível carregar as aquisições"
      onRetry={() => null}
    />
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
        <span>{acquisitionTerms(sale)}</span>
        {sale.payment === "INSTALLMENTS" && sale.installmentCount > 1 && (
          <span className="text-caption text-muted-foreground">Parcelado por terceiros</span>
        )}
      </div>
    ),
  },
];

function acquisitionTerms(sale: Acquisition): string {
  if (sale.chargedCents === 0) return "Bolsa integral";
  if (sale.payment === "CASH") return "À vista";
  if (sale.installmentCount === 1) return "Cartão · à vista";
  return materialPaymentLabel(sale.chargedCents, sale.installmentCount);
}

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
          empty={{ title: "Nenhuma aquisição", description: "Ainda não há aquisições." }}
          errorTitle="Não foi possível carregar as aquisições"
          onRetry={() => null}
        />
      </div>
    </div>
  );
}
