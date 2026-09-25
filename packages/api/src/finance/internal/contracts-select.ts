import { deriveInstallmentLedger } from "@lazuli/domain";

import { toDateOnlyString } from "./shared.js";

export type ContractListRow = {
  id: string;
  payer: { id: string; name: string };
  student: {
    id: string;
    fullName: string;
    placements: Array<{ stage: string; classCode: string; modality: "PPT" | "Regular" }>;
  };
  agreedOn: string;
  startsOn: string;
  endsOn: string;
  monthlyAmountCents: number;
  principalAmountCents: number;
  installmentCount: number;
  uniformInstallmentAmountCents: number | null;
  firstDueDate: string;
  status: "INADIMPLENTE" | "EM_DIA" | "QUITADO" | "CANCELADO";
};

export const contractSelect = {
  id: true,
  commandFingerprint: true,
  agreedOn: true,
  startsOn: true,
  endsOn: true,
  monthlyAmountCents: true,
  payer: { select: { id: true, name: true } },
  student: {
    select: {
      id: true,
      fullName: true,
      enrollments: {
        where: { deletedAt: null, exitDate: null },
        select: {
          class: { select: { scheduleType: true, internalCode: true } },
          progressRecords: {
            where: { deletedAt: null, endDate: null },
            select: { stage: { select: { name: true } } },
          },
        },
      },
    },
  },
  orders: {
    where: { kind: "CONTRACT" as const },
    select: {
      principalAmountCents: true,
      installmentCount: true,
      firstDueDate: true,
      cancelledAt: true,
      installments: {
        where: { deletedAt: null },
        select: {
          amountCents: true,
          dueDate: true,
          waivedAt: true,
          adjustments: { where: { deletedAt: null }, select: { amountCents: true } },
          allocations: { where: { deletedAt: null }, select: { amountCents: true } },
        },
      },
    },
    take: 1,
  },
} as const;

type SelectedContract = {
  id: string;
  payer: { id: string; name: string };
  student: {
    id: string;
    fullName: string;
    enrollments: Array<{
      class: { scheduleType: "REGULAR" | "PERSONALIZED"; internalCode: string };
      progressRecords: Array<{ stage: { name: string } }>;
    }>;
  };
  agreedOn: Date | null;
  startsOn: Date | null;
  endsOn: Date | null;
  monthlyAmountCents: number | null;
  orders: Array<{
    principalAmountCents: number;
    installmentCount: number | null;
    firstDueDate: Date | null;
    cancelledAt: Date | null;
    installments: Array<{
      amountCents: number;
      dueDate: Date;
      waivedAt: Date | null;
      adjustments: Array<{ amountCents: number }>;
      allocations: Array<{ amountCents: number }>;
    }>;
  }>;
};

function paymentStatus(
  order: SelectedContract["orders"][number],
  now: Date,
): ContractListRow["status"] {
  if (order.cancelledAt) return "CANCELADO";
  const ledgers = order.installments.map((installment) =>
    deriveInstallmentLedger({
      ...installment,
      orderCancelledAt: order.cancelledAt,
      now,
      interestRatePctMonthly: 0,
    }),
  );
  if (ledgers.some((ledger) => ledger.status === "OVERDUE" && ledger.collectibleRemainingCents > 0))
    return "INADIMPLENTE";
  return ledgers.every((ledger) => ledger.status === "PAID") ? "QUITADO" : "EM_DIA";
}

function academicPlacements(
  student: SelectedContract["student"],
): ContractListRow["student"]["placements"] {
  return student.enrollments.flatMap((enrollment) =>
    enrollment.progressRecords.map((progress) => ({
      stage: progress.stage.name,
      classCode: enrollment.class.internalCode,
      modality:
        enrollment.class.scheduleType === "PERSONALIZED" ? ("PPT" as const) : ("Regular" as const),
    })),
  );
}

function uniformInstallmentAmount(order: SelectedContract["orders"][number]): number | null {
  const firstAmount = order.installments[0]?.amountCents ?? null;
  return order.installments.length === order.installmentCount &&
    order.installments.every((row) => row.amountCents === firstAmount)
    ? firstAmount
    : null;
}

export function toRow(row: SelectedContract, now = new Date()): ContractListRow {
  const order = row.orders[0];
  if (
    !order ||
    !row.agreedOn ||
    !row.startsOn ||
    !row.endsOn ||
    row.monthlyAmountCents === null ||
    !order.firstDueDate ||
    order.installmentCount === null
  ) {
    throw new Error("Contrato mensal incompleto.");
  }
  return {
    id: row.id,
    payer: row.payer,
    student: {
      id: row.student.id,
      fullName: row.student.fullName,
      placements: academicPlacements(row.student),
    },
    agreedOn: toDateOnlyString(row.agreedOn),
    startsOn: toDateOnlyString(row.startsOn),
    endsOn: toDateOnlyString(row.endsOn),
    monthlyAmountCents: row.monthlyAmountCents,
    principalAmountCents: order.principalAmountCents,
    installmentCount: order.installmentCount,
    uniformInstallmentAmountCents: uniformInstallmentAmount(order),
    firstDueDate: toDateOnlyString(order.firstDueDate),
    status: paymentStatus(order, now),
  };
}
