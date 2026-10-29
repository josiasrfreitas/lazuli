"use client";

import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import type { RouterOutputs } from "@lazuli/api";
import {
  Alert,
  Button,
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  InlineSkeleton,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { ContractSetup } from "~/features/contracts/contract-setup";
import { useRenewalModel } from "./contract-renewal-model";
import layout from "~/features/contracts/contract-setup.module.css";
import styles from "./contract-renewal.module.css";

type Props = { contractId: string; onClose: () => void; onSaved: () => void };
type RenewalTerms = RouterOutputs["finance"]["renewalTerms"];

export function RenewalDialog(props: Props): ReactElement {
  const query = trpc.finance.renewalTerms.useQuery({ contractId: props.contractId });
  const [pending, setPending] = useState(false);
  const close = (): void => {
    if (!pending) props.onClose();
  };
  return (
    <RenewalShell
      onClose={close}
      description={
        query.data
          ? `${query.data.student.fullName} · revise os termos da renovação`
          : "Revise os termos da renovação"
      }
    >
      {query.data ? (
        <div className={styles.ready}>
          <RenewalFields
            key={props.contractId}
            {...props}
            data={query.data}
            onPendingChange={setPending}
          />
        </div>
      ) : query.error ? (
        <div className={styles.feedback}>
          <Alert variant="destructive">Não foi possível carregar os termos anteriores.</Alert>
          <Button
            variant="secondary"
            loading={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : (
        <RenewalLoading />
      )}
    </RenewalShell>
  );
}

function RenewalShell({
  onClose,
  description,
  children,
}: {
  onClose: () => void;
  description: string;
  children: ReactNode;
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
        <DialogContent className="md:max-w-6xl h-[min(48rem,calc(100dvh-4rem))]">
          <DialogHeader>
            <DialogTitle>Renovar contrato</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function RenewalFields({
  data,
  onClose,
  onSaved,
  onPendingChange,
}: Props & { data: RenewalTerms; onPendingChange: (pending: boolean) => void }): ReactElement {
  const model = useRenewalModel({ data, onClose, onSaved });
  useEffect(() => {
    onPendingChange(model.pending);
  }, [model.pending, onPendingChange]);
  const close = (): void => {
    if (!model.pending) onClose();
  };
  return (
    <ContractSetup
      state={model.state}
      renewedFromId={data.id}
      offer={{ data: data.offer, isPending: false, isError: false, refetch: () => undefined }}
      pending={model.pending}
      studentKnown
      allowEnrollmentFee={false}
      billingFirstDueDate={{ value: model.firstDueDate, onChange: model.changeDueDate }}
      error={model.error}
      completeLabel="Confirmar renovação"
      onRestoreTerms={model.restoreTerms}
      onComplete={model.submit}
      onBack={close}
    />
  );
}

function RenewalLoading(): ReactElement {
  return (
    <div
      className={`${layout.root} ${styles.loading}`}
      aria-busy="true"
      aria-label="Carregando renovação"
    >
      <span className="sr-only" role="status">
        Carregando os termos do contrato…
      </span>
      <div className={layout.layout} aria-hidden="true">
        <aside className={`${layout.summary} ${styles.skeletonSummary}`}>
          <div className={layout.summaryHeading}>
            <h2>Resumo do contrato</h2>
          </div>
          <div className={layout.summaryList}>
            {["Responsável e período", "Mensalidades", "Material", "Conferência"].map((title) => (
              <div key={title} className={layout.summaryItem}>
                <span className={layout.summaryLabel}>{title}</span>
                <InlineSkeleton className="h-4 w-3/4" />
                <InlineSkeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </aside>
        <div className={layout.panel}>
          <header className={layout.panelHeading}>
            <div>
              <h2>Responsável e período</h2>
              <p>Carregando os termos do contrato…</p>
            </div>
            <span>1 de 4</span>
          </header>
          <div className={styles.skeletonFields}>
            {["Responsável financeiro", "Período do contrato"].map((title) => (
              <div key={title} className={styles.skeletonGroup}>
                <h3>{title}</h3>
                <div className={styles.skeletonRow}>
                  {[0, 1, 2, 3].map((field) => (
                    <div key={field} className={styles.skeletonField}>
                      <InlineSkeleton className="h-3 w-24" />
                      <InlineSkeleton shape="block" className="h-9 w-full" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={layout.footer}>
        <span />
        <div className={layout.footerActions}>
          <Button variant="secondary" disabled>
            Voltar
          </Button>
          <Button disabled>Continuar</Button>
        </div>
      </div>
    </div>
  );
}
