"use client";

import { useState, type ReactElement } from "react";
import { ChevronDown, RefreshCw, TriangleAlert } from "lucide-react";
import { useQueryState } from "nuqs";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  toastManager,
} from "@lazuli/ui";
import { RenewalDialog } from "~/features/contracts/contract-renewal-dialog";
import { formatDateOnlyBR, formatBRLFromCents } from "~/lib/format";
import { TreatmentDialog } from "~/features/financial-treatments/treatment-dialog";
import styles from "./student-contract-renewal.module.css";

export function StudentContractRenewal({
  contracts,
  studentId,
  ready = true,
  overdueCents,
}: {
  studentId: string;
  contracts: { id: string; startsOn: string | null }[];
  ready?: boolean;
  overdueCents: number;
}): ReactElement | null {
  const [acknowledged, setAcknowledged] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [requestedContractId, setRequestedContractId] = useQueryState("renovarContrato");
  const activeContractId =
    contractId ?? (ready ? contracts.find(({ id }) => id === requestedContractId)?.id : undefined);
  const closeRenewal = (): void => {
    setContractId(null);
    setAcknowledged(null);
    void setRequestedContractId(null);
  };
  const [negotiating, setNegotiating] = useState(false);
  const [choosing, setChoosing] = useState(false);
  if (contracts.length === 0) return null;
  return (
    <div className={styles.action}>
      {contracts.length === 1 ? (
        <Button variant="primary" size="sm" onClick={() => setContractId(contracts[0]!.id)}>
          <RefreshCw aria-hidden="true" /> Rematrícula
        </Button>
      ) : (
        <RenewalChooser {...{ contracts, choosing, setChoosing, setContractId }} />
      )}
      {negotiating ? (
        <TreatmentDialog studentId={studentId} onClose={() => setNegotiating(false)} />
      ) : (
        activeContractId && (
          <SelectedContractRenewal
            contractId={activeContractId}
            overdueCents={acknowledged === activeContractId ? 0 : overdueCents}
            onClose={closeRenewal}
            onReview={() => {
              setNegotiating(true);
              closeRenewal();
            }}
            onContinue={() => setAcknowledged(activeContractId)}
          />
        )
      )}
    </div>
  );
}

function SelectedContractRenewal({
  contractId,
  overdueCents,
  onClose,
  onReview,
  onContinue,
}: {
  contractId: string;
  overdueCents: number;
  onClose: () => void;
  onReview: () => void;
  onContinue: () => void;
}): ReactElement {
  if (overdueCents > 0) {
    return <RenewalDebtNotice {...{ overdueCents, onClose, onReview, onContinue }} />;
  }
  return (
    <RenewalDialog
      contractId={contractId}
      onClose={onClose}
      onSaved={() => toastManager.add({ title: "Rematrícula concluída", type: "success" })}
    />
  );
}

function RenewalChooser({
  contracts,
  choosing,
  setChoosing,
  setContractId,
}: {
  contracts: { id: string; startsOn: string | null }[];
  choosing: boolean;
  setChoosing: (value: boolean) => void;
  setContractId: (value: string) => void;
}): ReactElement {
  return (
    <Popover open={choosing} onOpenChange={setChoosing}>
      <PopoverTrigger render={<Button variant="primary" size="sm" />}>
        <RefreshCw aria-hidden="true" /> Rematrícula <ChevronDown aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" size="menu" showArrow={false}>
        <div className="grid gap-1">
          {contracts.map((contract) => (
            <Button
              key={contract.id}
              variant="ghost"
              size="sm"
              onClick={() => {
                setChoosing(false);
                setContractId(contract.id);
              }}
            >
              Contrato{contract.startsOn ? ` · ${formatDateOnlyBR(contract.startsOn)}` : ""}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RenewalDebtNotice({
  overdueCents,
  onClose,
  onReview,
  onContinue,
}: {
  overdueCents: number;
  onClose: () => void;
  onReview: () => void;
  onContinue: () => void;
}): ReactElement {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="grid gap-4 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert aria-hidden="true" className="size-5 shrink-0 text-destructive" />
              Este aluno está inadimplente
            </DialogTitle>
            <DialogDescription>
              Recomenda-se negociar as pendências antes da rematrícula.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Saldo vencido:{" "}
            <strong className="text-foreground">{formatBRLFromCents(overdueCents)}</strong>.
            Continuar com a rematrícula não quita nem renegocia essas cobranças.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={onContinue}>
              Continuar com a rematrícula
            </Button>
            <Button onClick={onReview}>Conferir pendências</Button>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
