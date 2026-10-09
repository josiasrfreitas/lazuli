import {
  deriveContractFinancialSummary,
  deriveContractServiceStatus,
  saoPauloDateOnly,
  type ContractFinancialStatus,
  type ContractFinancialSummary,
  type ContractServiceStatus,
} from "@lazuli/domain";

import { toDateOnlyString } from "./shared.js";

export type ContractListRow = {
  id: string;
  payer: { id: string; name: string };
  student: {
    id: string;
    fullName: string;
    placements: Array<{ stageCode: string; classCode: string }>;
  };
  agreedOn: string;
  startsOn: string;
  endsOn: string;
  monthlyAmountCents: number;
  principalAmountCents: number;
  installmentCount: number;
  paymentProgress: { paid: number; total: number; waived: number; cancelled: number };
  uniformInstallmentAmountCents: number | null;
  firstDueDate: string;
  status: ContractFinancialStatus;
  financialSummary: ContractFinancialSummary;
  serviceStatus: ContractServiceStatus;
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
        where: { deletedAt: null },
        select: {
          entryDate: true,
          exitDate: true,
          class: { select: { portalClassName: true } },
          progressRecords: {
            where: { deletedAt: null, endDate: null },
            select: { stage: { select: { internalCode: true } } },
          },
        },
      },
    },
  },
  orders: {
    where: { kind: "TUITION" as const },
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
      entryDate: Date;
      exitDate: Date | null;
      class: { portalClassName: string };
      progressRecords: Array<{ stage: { internalCode: string } }>;
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

function academicPlacements(
  student: SelectedContract["student"],
  now: Date,
): ContractListRow["student"]["placements"] {
  const today = saoPauloDateOnly(now);
  return student.enrollments
    .filter(
      (enrollment) =>
        toDateOnlyString(enrollment.entryDate) <= today &&
        (enrollment.exitDate === null || toDateOnlyString(enrollment.exitDate) > today),
    )
    .flatMap((enrollment) =>
      enrollment.progressRecords.map((progress) => ({
        stageCode: progress.stage.internalCode,
        classCode: enrollment.class.portalClassName,
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
      placements: academicPlacements(row.student, now),
    },
    agreedOn: toDateOnlyString(row.agreedOn),
    startsOn: toDateOnlyString(row.startsOn),
    endsOn: toDateOnlyString(row.endsOn),
    monthlyAmountCents: row.monthlyAmountCents,
    principalAmountCents: order.principalAmountCents,
    installmentCount: order.installmentCount,
    uniformInstallmentAmountCents: uniformInstallmentAmount(order),
    firstDueDate: toDateOnlyString(order.firstDueDate),
    ...deriveContractFinancialSummary({ ...order, now, installmentCount: order.installmentCount }),
    serviceStatus: deriveContractServiceStatus({
      startsOn: toDateOnlyString(row.startsOn),
      endsOn: toDateOnlyString(row.endsOn),
      now,
    }),
  };
}
