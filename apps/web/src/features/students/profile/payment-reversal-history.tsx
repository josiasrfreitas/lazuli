"use client";

import { useState, type ReactElement } from "react";
import { Download, Paperclip } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { MAX_PAYMENT_PROOF_BYTES, PAYMENT_PROOF_ACCEPT } from "@lazuli/validators";
import { Button, FileUpload, ToastAlert } from "@lazuli/ui";
import { formatBRLFromCents, formatDateOnlyBR } from "~/lib/format";
import { uploadPaymentReversalProof } from "~/features/installments/payment/payment-reversal-proof";

type Options = RouterOutputs["finance"]["paymentReversalOptions"];
type ReversalHistoryProps = {
  options: Options;
  onBusyChange: (busy: boolean) => void;
  onSaved: () => Promise<void>;
};

export function ReversalHistory({ props }: { props: ReversalHistoryProps }): ReactElement | null {
  if (props.options.reversals.length === 0) return null;
  return (
    <section className="grid gap-2 border-t border-border pt-3" aria-label="Histórico de reversões">
      <h3 className="text-sm font-semibold">Histórico deste recebimento</h3>
      {props.options.reversals.map((row) => (
        <ReversalHistoryRow
          key={row.id}
          row={row}
          onBusyChange={props.onBusyChange}
          onSaved={props.onSaved}
        />
      ))}
    </section>
  );
}

function ReversalHistoryRow({
  row,
  onBusyChange,
  onSaved,
}: {
  row: Options["reversals"][number];
  onBusyChange: ReversalHistoryProps["onBusyChange"];
  onSaved: ReversalHistoryProps["onSaved"];
}): ReactElement {
  return (
    <div className="rounded-sm border border-border p-2 text-caption">
      <div className="flex justify-between gap-2 font-medium">
        <span>
          {row.kind === "CANCELLATION" ? "Cancelamento" : "Estorno"} ·{" "}
          {formatDateOnlyBR(row.occurredOn)}
        </span>
        <span>{formatBRLFromCents(row.amountCents)}</span>
      </div>
      <p className="text-muted-foreground">
        {row.createdByName}
        {row.refundMethodName ? ` · ${row.refundMethodName}` : ""}
        {row.refundReference ? ` · ${row.refundReference}` : ""}
      </p>
      {row.reason && <p>{row.reason}</p>}
      {row.proofs.map((file) => (
        <a
          key={file.id}
          href={`/api/payment-reversal-proofs/${file.id}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-interactive underline-offset-4 hover:underline"
        >
          <Download aria-hidden="true" className="size-3" />
          {file.fileName}
        </a>
      ))}
      {row.kind === "REFUND" && (
        <ReversalProofAttach reversalId={row.id} onBusyChange={onBusyChange} onSaved={onSaved} />
      )}
    </div>
  );
}

function ReversalProofAttach({
  reversalId,
  onBusyChange,
  onSaved,
}: {
  reversalId: string;
  onBusyChange: (busy: boolean) => void;
  onSaved: () => Promise<void>;
}): ReactElement {
  const [file, setFile] = useState<File | undefined>();
  const [id, setId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function attach(): Promise<void> {
    if (!file || uploading) return;
    setError("");
    setUploading(true);
    onBusyChange(true);
    try {
      await uploadPaymentReversalProof({ id, paymentReversalId: reversalId, file });
      setFile(undefined);
      await onSaved();
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Não foi possível enviar o comprovante.");
    } finally {
      setUploading(false);
      onBusyChange(false);
    }
  }

  return (
    <div className="grid gap-1 pt-1">
      <FileUpload
        compact
        value={file ? [file] : []}
        onValueChange={(files) => {
          setFile(files[0]);
          setId(crypto.randomUUID());
          setError("");
        }}
        onValidationError={setError}
        accept={PAYMENT_PROOF_ACCEPT}
        acceptLabel="PDF, JPG ou PNG"
        maxSize={MAX_PAYMENT_PROOF_BYTES}
        disabled={uploading}
        status={uploading ? "uploading" : "idle"}
        renderTrigger={(picker) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={picker.disabled}
            onClick={picker.open}
          >
            <Paperclip aria-hidden="true" /> Anexar comprovante
          </Button>
        )}
      />
      {file && (
        <Button
          type="button"
          size="sm"
          loading={uploading}
          disabled={Boolean(error)}
          onClick={() => void attach()}
        >
          Salvar comprovante
        </Button>
      )}
      {error && <ToastAlert variant="destructive">{error}</ToastAlert>}
    </div>
  );
}
