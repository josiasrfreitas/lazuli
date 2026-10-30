"use client";

import { useRef, useState, type ReactElement, type RefObject } from "react";
import { Check, ChevronRight, Download, Paperclip } from "lucide-react";
import { Alert, Button, FileUpload, InlineSkeleton, formatFileSize } from "@lazuli/ui";
import { MAX_PAYMENT_PROOF_BYTES, PAYMENT_PROOF_ACCEPT } from "@lazuli/validators";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { formatBRLFromCents, formatDateOnlyBR } from "~/lib/format";
import { uploadPaymentProof } from "~/features/installments/payment/payment-proof";

type Payment = RouterOutputs["finance"]["studentPayments"]["rows"][number];

export function StudentPayments({
  studentId,
  withProofs,
  onPendingChange,
}: {
  studentId: string;
  withProofs?: boolean;
  onPendingChange: (pending: boolean) => void;
}): ReactElement {
  const [busyId, setBusyId] = useState<string | null>(null);
  const query = trpc.finance.studentPayments.useInfiniteQuery(
    { studentId, withProofs },
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
            void utils.finance.studentPayments.invalidate();
            void utils.finance.studentSummary.invalidate();
            void utils.activity.invalidate();
          }}
        />
      ))}
      <PaymentMoreButton
        hasNext={Boolean(query.hasNextPage)}
        busy={query.isFetchingNextPage || busyId !== null}
        loading={query.isFetchingNextPage}
        next={() => void query.fetchNextPage()}
      />
    </div>
  );
}

function PaymentMoreButton({
  hasNext,
  busy,
  loading,
  next,
}: {
  hasNext: boolean;
  busy: boolean;
  loading: boolean;
  next: () => void;
}): ReactElement | null {
  if (!hasNext) return null;
  return (
    <Button variant="secondary" size="sm" disabled={busy} onClick={next}>
      {loading ? "Carregando…" : "Carregar mais pagamentos"}
    </Button>
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
  if (pending)
    return (
      <div className="grid gap-3" role="status" aria-label="Carregando comprovantes">
        {[0, 1, 2].map((item) => (
          <div key={item} className="grid gap-2 rounded-md border border-border p-3">
            <div className="flex justify-between gap-3">
              <InlineSkeleton className="h-4 w-20" />
              <InlineSkeleton className="h-4 w-16" />
            </div>
            <InlineSkeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    );
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
    <details className="group min-w-0 rounded-md border border-border">
      <PaymentRowSummary payment={payment} />
      <div className="grid min-w-0 gap-3 border-t border-border p-3">
        <div className="text-caption text-muted-foreground">
          <p>Pagador: {payment.payer.name}</p>
          {payment.thirdPartyName && <p>Pix feito por: {payment.thirdPartyName}</p>}
          {payment.externalInstallments > 1 && (
            <p>
              {payment.externalInstallments} parcelas por terceiros · recebido de uma vez pela
              escola
            </p>
          )}
        </div>
        <PaymentProofLinks proofs={payment.proofs} />
        <PaymentProofPicker
          file={upload.file}
          disabled={disabled}
          uploading={upload.uploading}
          onFile={upload.setFile}
          onValidationError={upload.setValidationError}
        />
        <PaymentRowFeedback
          file={upload.file}
          disabled={disabled}
          validationError={upload.validationError}
          uploading={upload.uploading}
          error={upload.error}
          saved={upload.saved}
          onAttach={() => void upload.attach()}
        />
      </div>
    </details>
  );
}

function PaymentRowSummary({ payment }: { payment: Payment }): ReactElement {
  return (
    <summary className="flex cursor-pointer list-none items-center gap-2 p-3 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
      <ChevronRight
        className="size-4 shrink-0 transition-transform group-open:rotate-90"
        aria-hidden="true"
      />
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-caption font-semibold">
          <span>{formatDateOnlyBR(payment.date)}</span>
          <span className="font-numeric tabular-nums">
            {formatBRLFromCents(payment.amountCents)}
          </span>
        </div>
        <span className="text-caption text-muted-foreground">
          {payment.paymentMethod.name} ·{" "}
          {payment.proofs.length === 0
            ? "Sem comprovante"
            : `${payment.proofs.length} ${payment.proofs.length === 1 ? "comprovante" : "comprovantes"}`}
        </span>
      </div>
    </summary>
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
