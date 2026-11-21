"use client";

import { useState, type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Download, Paperclip, ReceiptText } from "lucide-react";
import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  EmptyState,
  FileUpload,
  ToastAlert,
} from "@lazuli/ui";
import { MAX_PAYMENT_PROOF_BYTES, PAYMENT_PROOF_ACCEPT } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatBRLFromCents, formatDateOnlyBR } from "~/lib/format";
import { uploadPaymentProof } from "./payment/payment-proof";

export function InstallmentProofDialog({
  installmentId,
  payerName,
  onClose,
}: {
  installmentId: string;
  payerName: string;
  onClose: () => void;
}): ReactElement {
  const query = trpc.finance.installmentPayments.useQuery({ installmentId });
  const utils = trpc.useUtils();
  const [file, setFile] = useState<File | undefined>();
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function attach(paymentEntryId: string): Promise<void> {
    if (!file || uploading || selectedPaymentId !== paymentEntryId) return;
    setUploading(true);
    setError("");
    try {
      await uploadPaymentProof({ id: crypto.randomUUID(), paymentEntryId, file });
      await Promise.allSettled([
        query.refetch(),
        utils.finance.installments.invalidate(),
        utils.finance.contractInstallments.invalidate(),
        utils.finance.studentPayments.invalidate(),
        utils.finance.studentSummary.invalidate(),
      ]);
      setFile(undefined);
      setSelectedPaymentId(null);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Não foi possível anexar o comprovante.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <InstallmentProofView
      payerName={payerName}
      onClose={onClose}
      uploading={uploading}
      pending={query.isPending}
      queryError={query.isError}
      rows={query.data?.rows}
      onRetry={() => void query.refetch()}
      selectedPaymentId={selectedPaymentId}
      file={file}
      error={error}
      setSelectedPaymentId={setSelectedPaymentId}
      setFile={setFile}
      setError={setError}
      onAttach={attach}
    />
  );
}

type ProofDialogViewProps = {
  payerName: string;
  onClose: () => void;
  uploading: boolean;
  pending: boolean;
  queryError: boolean;
  rows: PaymentProof[] | undefined;
  onRetry: () => void;
  selectedPaymentId: string | null;
  file: File | undefined;
  error: string;
  setSelectedPaymentId: (id: string | null) => void;
  setFile: (file: File | undefined) => void;
  setError: (error: string) => void;
  onAttach: (paymentEntryId: string) => Promise<void>;
};

function InstallmentProofView(props: ProofDialogViewProps): ReactElement {
  const {
    payerName,
    onClose,
    uploading,
    pending,
    queryError,
    rows,
    onRetry,
    selectedPaymentId,
    file,
    error,
    setSelectedPaymentId,
    setFile,
    setError,
    onAttach,
  } = props;
  return (
    <Dialog
      open
      onOpenChange={(open, event) => {
        if (!open && uploading) event.cancel();
        else if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="md:max-w-xl" showCloseButton={!uploading}>
          <DialogHeader>
            <DialogTitle>Comprovantes de pagamento</DialogTitle>
            <DialogDescription>{payerName}</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-3">
            <PaymentProofStatus
              pending={pending}
              error={queryError}
              empty={rows?.length === 0}
              onRetry={onRetry}
            />
            {rows?.map((payment) => (
              <PaymentProofRow
                key={payment.id}
                payment={payment}
                selectedPaymentId={selectedPaymentId}
                file={file}
                error={error}
                uploading={uploading}
                setSelectedPaymentId={setSelectedPaymentId}
                setFile={setFile}
                setError={setError}
                onAttach={onAttach}
              />
            ))}
            {error && <ToastAlert variant="destructive">{error}</ToastAlert>}
          </DialogBody>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

type PaymentProof = RouterOutputs["finance"]["installmentPayments"]["rows"][number];

function PaymentProofStatus({
  pending,
  error,
  empty,
  onRetry,
}: {
  pending: boolean;
  error: boolean;
  empty: boolean;
  onRetry: () => void;
}): ReactElement {
  return (
    <>
      {pending && <p role="status">Carregando pagamentos…</p>}
      {error && (
        <ToastAlert variant="destructive">
          Não foi possível carregar os pagamentos.
          <Button variant="link" onClick={onRetry}>
            Tentar novamente
          </Button>
        </ToastAlert>
      )}
      {empty && (
        <p className="text-sm text-muted-foreground">
          Nenhum recebimento vinculado a esta parcela.
        </p>
      )}
    </>
  );
}

function PaymentProofRow({
  payment,
  selectedPaymentId,
  file,
  error,
  uploading,
  setSelectedPaymentId,
  setFile,
  setError,
  onAttach,
}: {
  payment: PaymentProof;
  selectedPaymentId: string | null;
  file: File | undefined;
  error: string;
  uploading: boolean;
  setSelectedPaymentId: (id: string | null) => void;
  setFile: (file: File | undefined) => void;
  setError: (error: string) => void;
  onAttach: (paymentEntryId: string) => Promise<void>;
}): ReactElement {
  const selectedFile = selectedPaymentId === payment.id ? file : undefined;
  const showEmptyState = payment.proofs.length === 0 && !selectedFile;
  return (
    <section className="grid gap-3 rounded-md border border-border p-3">
      <PaymentProofHeading payment={payment} />
      {payment.proofs.length > 0 && <PaymentProofLinks proofs={payment.proofs} />}
      {showEmptyState && (
        <EmptyState
          className="py-3"
          icon={<ReceiptText />}
          title="Pagamento registrado"
          description="O comprovante ainda não deu o ar da graça."
        />
      )}
      <FileUpload
        compact
        value={selectedFile ? [selectedFile] : []}
        onValueChange={(files) => {
          setSelectedPaymentId(payment.id);
          setFile(files[0]);
          setError("");
        }}
        onValidationError={setError}
        accept={PAYMENT_PROOF_ACCEPT}
        acceptLabel="PDF, JPG ou PNG"
        maxSize={MAX_PAYMENT_PROOF_BYTES}
        disabled={uploading}
        status={uploading && selectedPaymentId === payment.id ? "uploading" : "idle"}
        renderTrigger={(picker) => (
          <Button
            variant={showEmptyState ? "primary" : "ghost"}
            size="sm"
            className="justify-self-center"
            disabled={picker.disabled}
            onClick={picker.open}
          >
            <Paperclip aria-hidden="true" /> Anexar comprovante
          </Button>
        )}
      />
      {selectedFile && (
        <Button
          size="sm"
          loading={uploading}
          disabled={Boolean(error)}
          onClick={() => void onAttach(payment.id)}
        >
          Salvar comprovante
        </Button>
      )}
    </section>
  );
}

function PaymentProofLinks({ proofs }: { proofs: PaymentProof["proofs"] }): ReactElement {
  return (
    <div className="grid gap-2">
      {proofs.map((proof) => (
        <a
          key={proof.id}
          href={`/api/payment-proofs/${proof.id}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-sm text-interactive underline-offset-4 hover:underline"
        >
          <Download aria-hidden="true" className="size-4 shrink-0" />
          <span className="min-w-0 break-all">{proof.fileName}</span>
        </a>
      ))}
    </div>
  );
}

function PaymentProofHeading({ payment }: { payment: PaymentProof }): ReactElement {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="font-medium">Pago em {formatDateOnlyBR(payment.date)}</h3>
      <span className="font-numeric tabular-nums">
        {formatBRLFromCents(payment.amountCents)} nesta parcela
      </span>
    </div>
  );
}
