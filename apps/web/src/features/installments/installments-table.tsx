import type { ReactNode, ReactElement } from "react";
import {
  Badge,
  Button,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from "@lazuli/ui";
import type { FinanceInstallmentRow } from "@lazuli/validators";
import { businessDate, installmentVm } from "./view-model";

function InstallmentRow({
  row,
  today,
}: {
  row: FinanceInstallmentRow;
  today: string;
}): ReactElement {
  const vm = installmentVm(row, today);
  return (
    <TableRow>
      <TableCell>
        <span className="font-numeric tabular-nums">{vm.sequence}</span>
      </TableCell>
      <TableCell className="break-words">{row.payer.name}</TableCell>
      <TableCell className="break-words">
        {row.beneficiaries.map((person) => person.fullName).join(", ") || "—"}
      </TableCell>
      <TableCell>
        <span className="font-numeric tabular-nums">{vm.dueDate}</span>
      </TableCell>
      <TableCell numeric>
        <span className="font-numeric tabular-nums">{vm.amount}</span>
        {vm.balance === null ? null : (
          <p className="font-numeric text-xs tabular-nums text-muted-foreground">{vm.balance}</p>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={vm.badge.variant}>{vm.badge.label}</Badge>
      </TableCell>
    </TableRow>
  );
}
function InstallmentsHead(): ReactElement {
  return (
    <TableHeader sticky>
      <TableRow>
        <TableHead className="w-1/12">Parcela</TableHead>
        <TableHead className="w-2/12">Pagador</TableHead>
        <TableHead className="w-2/12">Beneficiário(s)</TableHead>
        <TableHead className="w-2/12">Vencimento</TableHead>
        <TableHead className="w-3/12" numeric>
          Valor
        </TableHead>
        <TableHead className="w-2/12">Status</TableHead>
      </TableRow>
    </TableHeader>
  );
}
type TableState = {
  rows: FinanceInstallmentRow[] | undefined;
  error: boolean;
  filtered: boolean;
  onRetry: () => void;
};
const COLUMN_COUNT = 6;
const AMOUNT_COLUMN_INDEX = 4;
const NUMERIC_COLUMNS = [AMOUNT_COLUMN_INDEX];
const SKELETON_ROWS = 10;
function InstallmentsBody({
  rows,
  error,
  filtered,
  onRetry,
  today,
}: TableState & { today: string }): ReactNode {
  if (error)
    return (
      <TableEmpty colSpan={COLUMN_COUNT}>
        <EmptyState
          title="Não foi possível carregar as parcelas"
          description="Verifique a conexão e tente de novo."
          action={
            <Button size="sm" variant="secondary" onClick={onRetry}>
              Tentar de novo
            </Button>
          }
        />
      </TableEmpty>
    );
  if (rows === undefined)
    return (
      <TableSkeleton columns={COLUMN_COUNT} numericColumns={NUMERIC_COLUMNS} rows={SKELETON_ROWS} />
    );
  if (rows.length === 0)
    return (
      <TableEmpty colSpan={COLUMN_COUNT}>
        <EmptyState
          title={filtered ? "Nenhuma parcela encontrada" : "Nenhuma parcela cadastrada"}
          description={
            filtered
              ? "Ajuste a busca ou o filtro de status."
              : "As parcelas aparecerão aqui quando forem cadastradas."
          }
        />
      </TableEmpty>
    );
  return rows.map((row) => <InstallmentRow key={row.installmentId} row={row} today={today} />);
}
export function InstallmentsTable({
  updating,
  footer,
  ...state
}: TableState & { updating: boolean; footer: ReactNode }): ReactElement {
  return (
    <TableContainer viewportBound footer={footer}>
      <Table aria-label="Lista de parcelas" aria-busy={updating} className="min-w-4xl table-fixed">
        <InstallmentsHead />
        <TableBody>
          <InstallmentsBody {...state} today={businessDate(new Date())} />
        </TableBody>
      </Table>
    </TableContainer>
  );
}
