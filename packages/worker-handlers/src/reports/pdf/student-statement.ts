/**
 * Student statement PDF data loading (§7.2): all orders where the student is
 * an `OrderBeneficiary`, installments with derived ledger statuses (waived/
 * cancelled shown as history with zero open balance), and payment entries
 * with allocations toward those orders.
 */

import type { Prisma } from "@lazuli/db";
import { deriveInstallmentLedger, deriveOrderLedger } from "@lazuli/domain";

import { ReportGenerationError } from "../report-error.js";
import { formatCentsBRL, formatDateOnlyPtBr, formatInstantPtBr } from "../templates/format.js";
import {
  installmentStatusLabel,
  orderKindLabel,
  orderStatusLabel,
  paymentMethodLabel,
} from "../templates/labels.js";
import type {
  StatementOrderSection,
  StatementPaymentRow,
  StudentStatementTemplateData,
} from "../templates/student-statement.template.js";

type StudentStatementDatabase = Pick<
  Prisma.TransactionClient,
  "student" | "order" | "paymentEntry" | "financeSettings"
>;

export async function loadStudentStatementTemplateData(input: {
  database: StudentStatementDatabase;
  studentId: string;
  now: Date;
}): Promise<StudentStatementTemplateData> {
  const student = await loadStudent(input);
  const interestRatePctMonthly = await loadInterestRate(input.database);
  const orders = await loadOrders(input);
  const payments = await loadPayments(input);

  return {
    generatedAt: formatInstantPtBr(input.now),
    studentName: student.fullName,
    orders: orders.map((order) =>
      toOrderSection({ order, now: input.now, interestRatePctMonthly }),
    ),
    payments: payments.map((payment) => toPaymentRow(payment)),
  };
}

async function loadStudent(input: {
  database: StudentStatementDatabase;
  studentId: string;
}): Promise<{ fullName: string }> {
  const student = await input.database.student.findFirst({
    where: { id: input.studentId, deletedAt: null },
    select: { fullName: true },
  });

  if (student === null) {
    throw new ReportGenerationError({
      code: "SETUP_ERROR_STUDENT_NOT_FOUND",
      message: `Aluno ${input.studentId} não encontrado.`,
    });
  }

  return student;
}

async function loadInterestRate(database: StudentStatementDatabase): Promise<number> {
  const settings = await database.financeSettings.findUnique({
    where: { id: "singleton" },
    select: { interestRatePctMonthly: true },
  });

  return settings === null ? 1 : Number(settings.interestRatePctMonthly);
}

type LoadedOrder = {
  id: string;
  kind: string;
  principalAmountCents: number;
  startDate: Date;
  cancelledAt: Date | null;
  cancelledReason: string | null;
  payer: { name: string };
  installments: {
    amountCents: number;
    dueDate: Date;
    waivedAt: Date | null;
    adjustments: { amountCents: number }[];
    allocations: { amountCents: number }[];
  }[];
};

function loadOrders(input: {
  database: StudentStatementDatabase;
  studentId: string;
}): Promise<LoadedOrder[]> {
  return input.database.order.findMany({
    where: {
      deletedAt: null,
      beneficiaries: { some: { studentId: input.studentId, deletedAt: null } },
    },
    select: {
      id: true,
      kind: true,
      principalAmountCents: true,
      startDate: true,
      cancelledAt: true,
      cancelledReason: true,
      payer: { select: { name: true } },
      installments: {
        where: { deletedAt: null },
        select: {
          amountCents: true,
          dueDate: true,
          waivedAt: true,
          adjustments: { where: { deletedAt: null }, select: { amountCents: true } },
          allocations: { where: { deletedAt: null }, select: { amountCents: true } },
        },
        orderBy: { dueDate: "asc" },
      },
    },
    orderBy: { startDate: "asc" },
  });
}

function toOrderSection(input: {
  order: LoadedOrder;
  now: Date;
  interestRatePctMonthly: number;
}): StatementOrderSection {
  const { order } = input;
  const orderLedger = deriveOrderLedger({
    cancelledAt: order.cancelledAt,
    installments: order.installments,
    now: input.now,
    interestRatePctMonthly: input.interestRatePctMonthly,
  });

  return {
    orderId: order.id,
    kindLabel: orderKindLabel(order.kind),
    statusLabel: orderStatusLabel(orderLedger.status),
    payerName: order.payer.name,
    principal: formatCentsBRL(order.principalAmountCents),
    startDate: formatDateOnlyPtBr(order.startDate),
    cancelledNote: cancelledNote(order),
    installments: order.installments.map((installment) => {
      const ledger = deriveInstallmentLedger({
        ...installment,
        orderCancelledAt: order.cancelledAt,
        now: input.now,
        interestRatePctMonthly: input.interestRatePctMonthly,
      });

      return {
        dueDate: formatDateOnlyPtBr(installment.dueDate),
        originalAmount: formatCentsBRL(installment.amountCents),
        currentExpected: formatCentsBRL(ledger.currentExpectedCents),
        paid: formatCentsBRL(ledger.paidAmountCents),
        openBalance: formatCentsBRL(ledger.collectibleRemainingCents),
        statusLabel: installmentStatusLabel(ledger.status),
      };
    }),
  };
}

function cancelledNote(order: LoadedOrder): string | null {
  if (order.cancelledAt === null) {
    return null;
  }

  const reason = order.cancelledReason === null ? "" : ` Motivo: ${order.cancelledReason}.`;

  return `Pedido cancelado em ${formatInstantPtBr(order.cancelledAt)} — histórico não cobrável.${reason}`;
}

type LoadedPayment = {
  date: Date;
  amountCents: number;
  method: string;
  note: string | null;
  payer: { name: string };
  allocations: { amountCents: number }[];
};

function loadPayments(input: {
  database: StudentStatementDatabase;
  studentId: string;
}): Promise<LoadedPayment[]> {
  return input.database.paymentEntry.findMany({
    where: {
      deletedAt: null,
      allocations: {
        some: {
          deletedAt: null,
          installment: {
            order: {
              beneficiaries: { some: { studentId: input.studentId, deletedAt: null } },
            },
          },
        },
      },
    },
    select: {
      date: true,
      amountCents: true,
      method: true,
      note: true,
      payer: { select: { name: true } },
      allocations: { where: { deletedAt: null }, select: { amountCents: true } },
    },
    orderBy: { date: "asc" },
  });
}

function toPaymentRow(payment: LoadedPayment): StatementPaymentRow {
  return {
    date: formatDateOnlyPtBr(payment.date),
    payerName: payment.payer.name,
    methodLabel: paymentMethodLabel(payment.method),
    amount: formatCentsBRL(payment.amountCents),
    allocated: formatCentsBRL(
      payment.allocations.reduce((total, allocation) => total + allocation.amountCents, 0),
    ),
    note: payment.note ?? "",
  };
}
