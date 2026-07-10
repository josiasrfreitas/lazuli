/**
 * Student financial statement PDF template (§7.2): every order where the
 * student is a beneficiary, installments with derived statuses, cancelled/
 * waived rows shown as history, plus payment entries and allocations.
 */

import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";

import { buildDataTable, buildReportDocument, metaLine } from "./layout.js";

export type StatementInstallmentRow = {
  dueDate: string;
  originalAmount: string;
  currentExpected: string;
  paid: string;
  openBalance: string;
  statusLabel: string;
};

export type StatementOrderSection = {
  orderId: string;
  kindLabel: string;
  statusLabel: string;
  payerName: string;
  principal: string;
  startDate: string;
  cancelledNote: string | null;
  installments: readonly StatementInstallmentRow[];
};

export type StatementPaymentRow = {
  date: string;
  payerName: string;
  methodLabel: string;
  amount: string;
  allocated: string;
  note: string;
};

export type StudentStatementTemplateData = {
  generatedAt: string;
  studentName: string;
  orders: readonly StatementOrderSection[];
  payments: readonly StatementPaymentRow[];
};

const INSTALLMENT_HEADERS = [
  "Vencimento",
  "Valor original",
  "Valor atual",
  "Pago",
  "Em aberto",
  "Situação",
] as const;

const PAYMENT_HEADERS = ["Data", "Pagador", "Método", "Valor", "Alocado", "Observação"] as const;

export function buildStudentStatementDocDefinition(
  data: StudentStatementTemplateData,
): TDocumentDefinitions {
  return buildReportDocument({
    title: `Extrato financeiro — ${data.studentName}`,
    generatedAtLabel: data.generatedAt,
    content: [...ordersContent(data.orders), ...paymentsContent(data.payments)],
  });
}

function ordersContent(orders: readonly StatementOrderSection[]): Content[] {
  if (orders.length === 0) {
    return [{ text: "Nenhum pedido encontrado para o aluno.", style: "metaLine" }];
  }

  return orders.flatMap((order) => orderSection(order));
}

function orderSection(order: StatementOrderSection): Content[] {
  const header: Content[] = [
    {
      text: `Pedido ${order.orderId} — ${order.kindLabel} (${order.statusLabel})`,
      style: "sectionHeader",
    },
    metaLine("Pagador", order.payerName),
    metaLine("Valor contratado", order.principal),
    metaLine("Início", order.startDate),
  ];

  if (order.cancelledNote !== null) {
    header.push({ text: order.cancelledNote, style: "note" });
  }

  header.push(
    buildDataTable({
      headers: [...INSTALLMENT_HEADERS],
      rows: order.installments.map((row) => [
        row.dueDate,
        row.originalAmount,
        row.currentExpected,
        row.paid,
        row.openBalance,
        row.statusLabel,
      ]),
    }),
  );

  return header;
}

function paymentsContent(payments: readonly StatementPaymentRow[]): Content[] {
  const section: Content[] = [{ text: "Pagamentos e alocações", style: "sectionHeader" }];

  if (payments.length === 0) {
    section.push({ text: "Nenhum pagamento registrado.", style: "metaLine" });
    return section;
  }

  section.push(
    buildDataTable({
      headers: [...PAYMENT_HEADERS],
      rows: payments.map((payment) => [
        payment.date,
        payment.payerName,
        payment.methodLabel,
        payment.amount,
        payment.allocated,
        payment.note,
      ]),
    }),
  );

  return section;
}
