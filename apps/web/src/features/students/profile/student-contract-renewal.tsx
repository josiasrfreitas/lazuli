"use client";

import { useState, type ReactElement } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { useQueryState } from "nuqs";
import { Button, Popover, PopoverContent, PopoverTrigger, toastManager } from "@lazuli/ui";
import { RenewalDialog } from "~/features/contracts/contract-renewal-dialog";
import { formatDateOnlyBR } from "~/lib/format";
import styles from "./student-contract-renewal.module.css";

export function StudentContractRenewal({
  contracts,
  ready = true,
}: {
  contracts: { id: string; startsOn: string | null }[];
  ready?: boolean;
}): ReactElement | null {
  const [contractId, setContractId] = useState<string | null>(null);
  const [requestedContractId, setRequestedContractId] = useQueryState("renovarContrato");
  const activeContractId =
    contractId ?? (ready ? contracts.find(({ id }) => id === requestedContractId)?.id : undefined);
  const closeRenewal = (): void => {
    setContractId(null);
    void setRequestedContractId(null);
  };
  const [choosing, setChoosing] = useState(false);
  if (contracts.length === 0) return null;
  return (
    <div className={styles.action}>
      {contracts.length === 1 ? (
        <Button variant="primary" size="sm" onClick={() => setContractId(contracts[0]!.id)}>
          <RefreshCw aria-hidden="true" /> Renovar contrato
        </Button>
      ) : (
        <Popover open={choosing} onOpenChange={setChoosing}>
          <PopoverTrigger render={<Button variant="primary" size="sm" />}>
            <RefreshCw aria-hidden="true" /> Renovar contrato <ChevronDown aria-hidden="true" />
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
      )}
      {activeContractId && (
        <RenewalDialog
          contractId={activeContractId}
          onClose={closeRenewal}
          onSaved={() => toastManager.add({ title: "Contrato renovado", type: "success" })}
        />
      )}
    </div>
  );
}
