"use client";

import { useState, type ReactElement } from "react";
import { FileText, ReceiptText } from "lucide-react";
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
  DialogTrigger,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import type { StudentFinanceState } from "./finance-logic";
import { trpc } from "~/lib/trpc";
import type { StudentProfile } from "./logic";
import { FinanceContractTerms } from "./finance-contract-terms";
import { FinancePaymentHistory } from "./finance-payment-history";
import styles from "./finance-details-dialog.module.css";
import "./finance-details-dialog.css";

type Summary = NonNullable<StudentFinanceState["summary"]["data"]>;
type View = "contract" | "payments";

export function FinanceDetails({
  summary,
  profile,
}: {
  summary: Summary;
  profile: StudentProfile;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [view, setView] = useState<View>("contract");
  const receipts = trpc.finance.studentPayments.useInfiniteQuery(
    { studentId: profile.id },
    { enabled: open, getNextPageParam: (page) => page.nextCursor },
  );
  const hasReceipts = receipts.data?.pages.some((page) => page.rows.length > 0) ?? false;
  return (
    <Dialog
      open={open}
      onOpenChange={(next, event) => {
        if (pending) event.cancel();
        else {
          setOpen(next);
          if (next) setView("contract");
        }
      }}
    >
      <DialogTrigger render={<Button variant="secondary" size="sm" />}>
        <FileText aria-hidden="true" /> Contrato e detalhes
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className="finance-details-dialog"
          motion="subtle"
          showCloseButton={!pending}
        >
          <DialogHeader>
            <div className={styles.header}>
              <div className={styles.identity}>
                <DialogTitle>Contrato e detalhes</DialogTitle>
                <DialogDescription>{profile.contact.fullName}</DialogDescription>
              </div>
              {hasReceipts && (
                <div className={styles.navigation}>
                  <DetailsNavigation view={view} pending={pending} onChange={setView} />
                </div>
              )}
            </div>
          </DialogHeader>
          <DialogBody className="mt-4">
            {open && (
              <DetailsBody
                view={hasReceipts ? view : "contract"}
                summary={summary}
                profile={profile}
                onPendingChange={setPending}
              />
            )}
          </DialogBody>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function DetailsBody({
  view,
  summary,
  profile,
  onPendingChange,
}: {
  view: View;
  summary: Summary;
  profile: StudentProfile;
  onPendingChange: (pending: boolean) => void;
}): ReactElement {
  if (view === "contract") return <FinanceContractTerms summary={summary} />;
  return (
    <FinancePaymentHistory
      summary={summary}
      studentId={profile.id}
      studentName={profile.contact.fullName}
      onPendingChange={onPendingChange}
    />
  );
}

function DetailsNavigation({
  view,
  pending,
  onChange,
}: {
  view: View;
  pending: boolean;
  onChange: (view: View) => void;
}): ReactElement {
  return (
    <SegmentedControl
      aria-label="Conteúdo dos detalhes financeiros"
      size="sm"
      value={view}
      disabled={pending}
      onValueChange={(next) => {
        if (next === "contract" || next === "payments") onChange(next);
      }}
    >
      <SegmentedControlItem value="contract">
        <FileText aria-hidden="true" className="mr-1.5 size-3.5" /> Contrato
      </SegmentedControlItem>
      <SegmentedControlItem value="payments">
        <ReceiptText aria-hidden="true" className="mr-1.5 size-3.5" /> Recebimentos
      </SegmentedControlItem>
    </SegmentedControl>
  );
}
