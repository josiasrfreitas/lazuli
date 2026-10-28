"use client";

import { useRef, useState, type ReactElement } from "react";
import { Check, Download, Paperclip } from "lucide-react";
import { Alert, Button, FileUpload, InlineSkeleton, formatFileSize } from "@lazuli/ui";
import { MAX_PAYMENT_PROOF_BYTES, PAYMENT_PROOF_ACCEPT } from "@lazuli/validators";
import { trpc, type RouterOutputs } from "~/lib/trpc";
import { formatBRLFromCents, formatDateOnlyBR } from "~/lib/format";
import { uploadPaymentProof } from "~/features/installments/payment/payment-proof";

type Payment = RouterOutputs["finance"]["studentPayments"]["rows"][number];

export function StudentPayments({
  studentId,
  onPendingChange,
}: {
  studentId: string;
  onPendingChange: (pending: boolean) => void;
}): ReactElement {
  const [busyId, setBusyId] = useState<string | null>(null);
  const query = trpc.finance.studentPayments.useInfiniteQuery(
    { studentId },
    { getNextPageParam: (page) => page.nextCursor },
  );
  const utils = trpc.useUtils();
  const rows = query.data?.pages.flatMap((page) => page.rows) ?? [];
  return (
    <div className="grid gap-4 pb-2">
      {query.isPending && <InlineSkeleton className="h-36 w-full" />}
      {query.isError && (
        <Alert variant="destructive">
          Não foi possível carregar os pagamentos.
          <Button variant="link" size="sm" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </Alert>
      )}
      {!query.isPending && !query.isError && rows.length === 0 && (
        <p className="py-6 text-caption text-muted-foreground">
          Nenhum pagamento registrado para este aluno.
        </p>
      )}
      {rows.map((payment) => (
        <PaymentRow
          key={payment.id}
          payment={payment}
          disabled={busyId !== null}
          onPendingChange={(pending) => {
            setBusyId(pending ? payment.id : null);
            onPendingChange(pending);
          }}
          onSaved={() => {
            void query.refetch();
            void utils.activity.invalidate();
          }}
        />
      ))}
      {query.hasNextPage && (
        <Button
          variant="secondary"
          size="sm"
          disabled={query.isFetchingNextPage || busyId !== null}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "Carregando…" : "Carregar mais pagamentos"}
        </Button>
      )}
    </div>
  );
}

function PaymentRow({
  payment,
  disabled,
  onPendingChange,
  onSaved,
}: {
  payment: Payment;
  disabled: boolean;
  onPendingChange: (pending: boolean) => void;
  onSaved: () => void;
}): ReactElement {
  const [file, setFile] = useState<File>();
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const id = useRef(crypto.randomUUID());
  const pending = useRef(false);
  async function attach(): Promise<void> {
    if (!file || validationError || disabled || pending.current) return;
    pending.current = true;
    setUploading(true);
    setError("");
    onPendingChange(true);
    try {
      await uploadPaymentProof({ id: id.current, paymentEntryId: payment.id, file });
      setFile(undefined);
      setSaved(true);
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível anexar o comprovante.");
    } finally {
      pending.current = false;
      setUploading(false);
      onPendingChange(false);
    }
  }
  return (
    <section
      className="grid min-w-0 gap-3 rounded-md border border-border p-4"
      aria-label={`Pagamento de ${formatDateOnlyBR(payment.date)}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-control font-semibold">{formatBRLFromCents(payment.amountCents)}</h3>
          <p className="text-caption text-muted-foreground">
            {formatDateOnlyBR(payment.date)} · {payment.paymentMethod.name}
          </p>
          <p className="text-caption text-muted-foreground">Pagador: {payment.payer.name}</p>
        </div>
        <FileUpload
          compact
          value={file ? [file] : []}
          onValueChange={(files) => {
            setFile(files[0]);
            id.current = crypto.randomUUID();
            setError("");
            setSaved(false);
          }}
          onValidationError={setValidationError}
          accept={PAYMENT_PROOF_ACCEPT}
          acceptLabel="PDF, JPG ou PNG"
          maxSize={MAX_PAYMENT_PROOF_BYTES}
          disabled={disabled}
          status={uploading ? "uploading" : "idle"}
          renderTrigger={(picker) => (
            <Button variant="ghost" size="sm" disabled={picker.disabled} onClick={picker.open}>
              <Paperclip aria-hidden="true" /> Anexar comprovante
            </Button>
          )}
        />
      </header>
      {payment.proofs.map((proof) => (
        <a
          key={proof.id}
          href={`/api/payment-proofs/${proof.id}`}
          className="flex min-w-0 items-center gap-2 text-caption text-interactive underline-offset-4 hover:underline"
          aria-label={`Baixar comprovante ${proof.fileName}`}
        >
          <Download className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-all">{proof.fileName}</span>
          <span className="shrink-0 text-muted-foreground">{formatFileSize(proof.byteLength)}</span>
        </a>
      ))}
      {file && (
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={disabled || Boolean(validationError)}
            onClick={() => void attach()}
          >
            <Paperclip aria-hidden="true" />{" "}
            {uploading ? "Enviando…" : error ? "Tentar envio novamente" : "Salvar comprovante"}
          </Button>
        </div>
      )}
      {error && <Alert variant="destructive">{error}</Alert>}
      {saved && (
        <p role="status" className="flex items-center gap-2 text-caption text-success">
          <Check className="size-4" aria-hidden="true" /> Comprovante anexado.
        </p>
      )}
    </section>
  );
}
