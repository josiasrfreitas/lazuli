import type { ReactElement } from "react";

import {
  Avatar,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@lazuli/ui";
import type { FinanceInstallmentRow, FinanceOverduePayerGroup } from "@lazuli/validators";
import { InstallmentAmount } from "./installment-amount";
import { installmentVm, overduePayerSummaryVm } from "./view-model";

const OVERDUE_COLUMNS = [
  { key: "installment", label: "Sequência" },
  { key: "origin", label: "Origem" },
  { key: "beneficiaries", label: "Beneficiário" },
  { key: "due-date", label: "Vencimento" },
  { key: "amount", label: "Em aberto" },
  { key: "status", label: "Atraso" },
] as const;

export function OverdueSearchGuidance(): ReactElement {
  return (
    <p className="shrink-0 px-5 py-3 text-sm text-muted-foreground">
      Exibindo todas as parcelas vencidas dos pagadores encontrados.
    </p>
  );
}

function beneficiaryNames(row: FinanceInstallmentRow): string {
  const names = row.beneficiaries.map((person) => person.fullName);
  if (names.length < 2) return names[0] ?? "—";
  return `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
}

function OverdueInstallmentRow({
  row,
  today,
  groupHeadingId,
}: {
  row: FinanceInstallmentRow;
  today: string;
  groupHeadingId: string;
}): ReactElement {
  const vm = installmentVm(row, today);
  return (
    <TableRow interactive={false}>
      <TableCell headers={`${groupHeadingId}-column-installment`}>
        <span className="font-numeric whitespace-nowrap tabular-nums">{vm.sequence}</span>
      </TableCell>
      <TableCell headers={`${groupHeadingId}-column-origin`}>{vm.origin}</TableCell>
      <TableCell headers={`${groupHeadingId}-column-beneficiaries`} className="break-words">
        {beneficiaryNames(row)}
      </TableCell>
      <TableCell headers={`${groupHeadingId}-column-due-date`}>
        <span className="font-numeric whitespace-nowrap tabular-nums">{vm.dueDate}</span>
      </TableCell>
      <TableCell headers={`${groupHeadingId}-column-amount`} numeric>
        <InstallmentAmount row={row} />
      </TableCell>
      <TableCell headers={`${groupHeadingId}-column-status`} numeric>
        <Badge variant="destructive">
          {row.overdueDays} {row.overdueDays === 1 ? "dia" : "dias"}
        </Badge>
      </TableCell>
    </TableRow>
  );
}

export function OverduePayerGroupCard({
  group,
  today,
}: {
  group: FinanceOverduePayerGroup;
  today: string;
}): ReactElement {
  const groupId = `installments-payer-${group.payer.id}`;

  return (
    <section
      aria-labelledby={groupId}
      className="contain-paint overflow-hidden rounded-lg border border-border bg-card"
      data-payer-id={group.payer.id}
      data-slot="overdue-payer-group"
    >
      <OverdueGroupHeader group={group} headingId={groupId} />
      <OverdueInstallmentsTable rows={group.rows} today={today} groupHeadingId={groupId} />
    </section>
  );
}

function OverdueGroupHeader({
  group,
  headingId,
}: {
  group: FinanceOverduePayerGroup;
  headingId: string;
}): ReactElement {
  const vm = overduePayerSummaryVm(group);
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-muted px-4 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar aria-hidden colorKey={group.payer.id} name={group.payer.name} size="sm" />
        <div className="min-w-0">
          <h2 id={headingId} className="break-words font-display font-semibold text-foreground">
            {group.payer.name}
          </h2>
          <p id={`${headingId}-summary`} className="text-xs text-muted-foreground">
            {vm.description}
          </p>
        </div>
      </div>
      <div className="ml-auto shrink-0 text-right">
        <span className="block text-xs text-muted-foreground">Saldo em aberto</span>
        <strong className="font-numeric block font-semibold tabular-nums text-destructive">
          {vm.balance}
        </strong>
      </div>
    </header>
  );
}

function OverdueInstallmentsTable({
  rows,
  today,
  groupHeadingId,
}: {
  rows: FinanceInstallmentRow[];
  today: string;
  groupHeadingId: string;
}): ReactElement {
  return (
    <div className="overflow-x-auto scrollbar-subtle">
      <Table
        aria-labelledby={groupHeadingId}
        aria-describedby={`${groupHeadingId}-summary`}
        className="min-w-240 table-fixed"
        density="compact"
      >
        <colgroup>
          <col className="w-24" />
          <col className="w-36" />
          <col />
          <col className="w-32" />
          <col className="w-60" />
          <col className="w-28" />
        </colgroup>
        <OverdueInstallmentsHead groupHeadingId={groupHeadingId} />
        <TableBody>
          {rows.map((row) => (
            <OverdueInstallmentRow
              key={row.installmentId}
              row={row}
              today={today}
              groupHeadingId={groupHeadingId}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function OverdueInstallmentsHead({ groupHeadingId }: { groupHeadingId: string }): ReactElement {
  return (
    <TableHeader>
      <TableRow interactive={false}>
        {OVERDUE_COLUMNS.map((column) => (
          <TableHead
            id={`${groupHeadingId}-column-${column.key}`}
            key={column.key}
            scope="col"
            numeric={column.key === "amount" || column.key === "status"}
          >
            {column.label}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}
