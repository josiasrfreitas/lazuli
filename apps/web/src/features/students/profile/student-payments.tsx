"use client";

import { useRef, useState, type ReactElement, type RefObject } from "react";
import { Check, Download, Paperclip } from "lucide-react";
import { Alert, Button, FileUpload, InlineSkeleton, formatFileSize } from "@lazuli/ui";
import { MAX_PAYMENT_PROOF_BYTES, PAYMENT_PROOF_ACCEPT } from "@lazuli/validators";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
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
      <PaymentListStatus
        pending={query.isPending}
        error={query.isError}
        empty={rows.length === 0}
        onRetry={() => void query.refetch()}
      />
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

function PaymentListStatus({
  pending,
  error,
  empty,
  onRetry,
}: {
  pending: boolean;
  error: boolean;
  empty: boolean;
  onRetry: () => void;
}): ReactElement | null {
  if (pending) return <InlineSkeleton className="h-36 w-full" />;
  if (error)
    return (
      <Alert variant="destructive">
        Não foi possível carregar os pagamentos.
        <Button variant="link" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      </Alert>
    );
  if (empty)
    return (
      <p className="py-6 text-caption text-muted-foreground">
        Nenhum pagamento registrado para este aluno.
      </p>
    );
  return null;
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
  const upload = usePaymentProofUpload({ payment, disabled, onPendingChange, onSaved });
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
        <PaymentProofPicker
          file={upload.file}
          disabled={disabled}
          uploading={upload.uploading}
          onFile={upload.setFile}
          onValidationError={upload.setValidationError}
        />
      </header>
      <PaymentProofLinks proofs={payment.proofs} />
      <PaymentRowFeedback
        file={upload.file}
        disabled={disabled}
        validationError={upload.validationError}
        uploading={upload.uploading}
        error={upload.error}
        saved={upload.saved}
        onAttach={() => void upload.attach()}
      />
    </section>
  );
}

type PaymentProofUpload = {
  file: File | undefined;
  error: string;
  validationError: string;
  uploading: boolean;
  saved: boolean;
  setFile: (file: File | undefined) => void;
  setValidationError: (error: string) => void;
  attach: () => Promise<void>;
};

type PaymentProofUploadParams = {
  payment: Payment;
  disabled: boolean;
  onPendingChange: (pending: boolean) => void;
  onSaved: () => void;
};

function usePaymentProofUpload({
  payment,
  disabled,
  onPendingChange,
  onSaved,
}: PaymentProofUploadParams): PaymentProofUpload {
  const [file, setFile] = useState<File>();
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const id = useRef(crypto.randomUUID());
  const pending = useRef(false);
  const attach = createPaymentProofAttach({
    paymentEntryId: payment.id,
    file,
    validationError,
    disabled,
    id,
    pending,
    setUploading,
    setError,
    onPendingChange,
    onSuccess: () => {
      setFile(undefined);
      setSaved(true);
      onSaved();
    },
  });
  function chooseFile(next: File | undefined): void {
    setFile(next);
    id.current = crypto.randomUUID();
    setError("");
    setSaved(false);
  }
  return {
    file,
    error,
    validationError,
    uploading,
    saved,
    setFile: chooseFile,
    setValidationError,
    attach,
  };
}

function createPaymentProofAttach({
  paymentEntryId,
  file,
  validationError,
  disabled,
  id,
  pending,
  setUploading,
  setError,
  onPendingChange,
  onSuccess,
}: {
  paymentEntryId: string;
  file: File | undefined;
  validationError: string;
  disabled: boolean;
  id: RefObject<string>;
  pending: RefObject<boolean>;
  setUploading: (uploading: boolean) => void;
  setError: (error: string) => void;
  onPendingChange: (pending: boolean) => void;
  onSuccess: () => void;
}): () => Promise<void> {
  return async () => {
    if (!file || validationError || disabled || pending.current) return;
    pending.current = true;
    setUploading(true);
    setError("");
    onPendingChange(true);
    try {
      await uploadSelectedProof({
        paymentEntryId,
        id: id.current,
        file,
        onSuccess,
        onError: setError,
      });
    } finally {
      pending.current = false;
      setUploading(false);
      onPendingChange(false);
    }
  };
}

async function uploadSelectedProof({
  paymentEntryId,
  id,
  file,
  onSuccess,
  onError,
}: {
  paymentEntryId: string;
  id: string;
  file: File;
  onSuccess: () => void;
  onError: (message: string) => void;
}): Promise<void> {
  try {
    await uploadPaymentProof({ id, paymentEntryId, file });
    onSuccess();
  } catch (error_) {
    onError(error_ instanceof Error ? error_.message : "Não foi possível anexar o comprovante.");
  }
}

function PaymentRowFeedback({
  file,
  disabled,
  validationError,
  uploading,
  error,
  saved,
  onAttach,
}: {
  file: File | undefined;
  disabled: boolean;
  validationError: string;
  uploading: boolean;
  error: string;
  saved: boolean;
  onAttach: () => void;
}): ReactElement {
  return (
    <>
      {file && (
        <div className="flex justify-end">
          <Button size="sm" disabled={disabled || Boolean(validationError)} onClick={onAttach}>
            <Paperclip aria-hidden="true" /> {paymentSubmitLabel(uploading, error)}
          </Button>
        </div>
      )}
      {error && <Alert variant="destructive">{error}</Alert>}
      {saved && (
        <p role="status" className="flex items-center gap-2 text-caption text-success">
          <Check className="size-4" aria-hidden="true" /> Comprovante anexado.
        </p>
      )}
    </>
  );
}

function PaymentProofPicker({
  file,
  disabled,
  uploading,
  onFile,
  onValidationError,
}: {
  file: File | undefined;
  disabled: boolean;
  uploading: boolean;
  onFile: (file: File | undefined) => void;
  onValidationError: (error: string) => void;
}): ReactElement {
  return (
    <FileUpload
      compact
      value={file ? [file] : []}
      onValueChange={(files) => onFile(files[0])}
      onValidationError={onValidationError}
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
  );
}

function paymentSubmitLabel(uploading: boolean, error: string): string {
  if (uploading) return "Enviando…";
  if (error) return "Tentar envio novamente";
  return "Salvar comprovante";
}

function PaymentProofLinks({ proofs }: { proofs: Payment["proofs"] }): ReactElement {
  return (
    <>
      {proofs.map((proof) => (
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
    </>
  );
}
