"use client";
import { useState, type ReactElement, type ReactNode } from "react";
import { DollarSign, X } from "lucide-react";
import { Button, FloatingToolbar } from "@lazuli/ui";
import type { FinanceInstallmentRow } from "@lazuli/validators";
import { PaymentDialog } from "./payment-dialog";
import { PaymentSelectionContext, toggleSelected, toggleVisibleSelection } from "./selection";
export type PaymentEntryControls = { action: ReactNode; toolbar: ReactNode };
export function PaymentEntry({
  visible,
  children,
}: {
  visible: FinanceInstallmentRow[];
  children: (controls: PaymentEntryControls) => ReactNode;
}): ReactElement {
  const [rows, setRows] = useState<FinanceInstallmentRow[]>([]);
  const { session, open, registered, begin, setOpen, complete } = useEntrySession(() =>
    setRows([]),
  );
  const outside = rows.filter(
    (row) => !visible.some((item) => item.installmentId === row.installmentId),
  ).length;
  const action = (
    <Button size="sm" onClick={() => begin([])}>
      <DollarSign aria-hidden="true" />
      Registrar pagamento
    </Button>
  );
  const toolbar =
    rows.length > 0 && !open ? (
      <SelectionToolbar
        count={rows.length}
        outside={outside}
        clear={() => setRows([])}
        begin={() => begin(rows)}
      />
    ) : null;
  return (
    <PaymentSelectionContext.Provider
      value={{
        rows,
        visible,
        toggle: (row) => setRows((current) => toggleSelected(current, row)),
        toggleVisible: () => setRows((current) => toggleVisibleSelection(current, visible)),
      }}
    >
      {registered && (
        <p role="status" className="px-6 pt-2 text-caption text-success">
          Pagamento registrado.
        </p>
      )}
      {children({ action, toolbar })}
      {session !== null && (
        <PaymentDialog rows={session} open={open} onOpenChange={setOpen} onRegistered={complete} />
      )}
    </PaymentSelectionContext.Provider>
  );
}

function SelectionToolbar({
  count,
  outside,
  clear,
  begin,
}: {
  count: number;
  outside: number;
  clear: () => void;
  begin: () => void;
}): ReactElement {
  return (
    <FloatingToolbar aria-label="Recebíveis selecionados">
      <Button size="icon-sm" variant="ghost" aria-label="Limpar seleção" onClick={clear}>
        <X aria-hidden="true" />
      </Button>
      <span role="status" className="text-caption">
        {count} selecionados{outside > 0 ? ` · ${outside} fora da vista` : ""}
      </span>
      <Button size="sm" onClick={begin}>
        <DollarSign aria-hidden="true" />
        Registrar pagamento
      </Button>
    </FloatingToolbar>
  );
}

type EntrySession = {
  session: FinanceInstallmentRow[] | null;
  open: boolean;
  registered: boolean;
  begin: (rows: FinanceInstallmentRow[]) => void;
  setOpen: (open: boolean) => void;
  complete: () => void;
};
function useEntrySession(clear: () => void): EntrySession {
  const [session, setSession] = useState<FinanceInstallmentRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [registered, setRegistered] = useState(false);
  return {
    session,
    open,
    registered,
    setOpen,
    begin: (rows) => {
      setSession((current) => {
        if (!current) return rows;
        if (rows.length === 0) return current;
        const ids = new Set(current.map((row) => row.installmentId));
        return [...current, ...rows.filter((row) => !ids.has(row.installmentId))];
      });
      setOpen(true);
      setRegistered(false);
    },
    complete: () => {
      setSession(null);
      setOpen(false);
      clear();
      setRegistered(true);
    },
  };
}
