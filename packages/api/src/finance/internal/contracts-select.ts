import type { Prisma } from "@lazuli/db";
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
  materialAmountCents: number;
  materials: Array<{
    id: string;
    name: string;
    totalCents: number;
    count: number;
    installmentCents: number | null;
  }>;
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
  terminatedAt: true,
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
    where: { deletedAt: null },
    select: {
      id: true,
      kind: true,
      material: { include: { items: { orderBy: { position: "asc" } } } },
      principalAmountCents: true,
      installmentCount: true,
      firstDueDate: true,
      cancelledAt: true,
      installments: {
        where: { deletedAt: null },
        orderBy: { sequenceNumber: "asc" },
        select: {
          id: true,
          sequenceNumber: true,
          amountCents: true,
          dueDate: true,
          waivedAt: true,
          adjustments: {
            where: { deletedAt: null },
            select: { amountCents: true, renegotiationId: true },
          },
          allocations: {
            where: { deletedAt: null, paymentEntry: { deletedAt: null } },
            select: { amountCents: true },
          },
        },
      },
    },
  },
} as const;

export type SelectedContract = Prisma.ContractGetPayload<{ select: typeof contractSelect }>;

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
  const firstAmount = order.installments[0]
    ? renegotiatedInstallmentAmount(order.installments[0])
    : null;
  return order.installments.length === order.installmentCount &&
    order.installments.every((row) => renegotiatedInstallmentAmount(row) === firstAmount)
    ? firstAmount
    : null;
}

export function renegotiatedInstallmentAmount(row: {
  amountCents: number;
  adjustments: { amountCents: number; renegotiationId?: string | null }[];
}): number {
  return (
    row.amountCents +
    row.adjustments.reduce(
      (sum, adjustment) => sum + (adjustment.renegotiationId ? adjustment.amountCents : 0),
      0,
    )
  );
}

export function toRow(row: SelectedContract, now = new Date()): ContractListRow {
  const order = requiredTuitionOrder(row);
  const materialOrders = row.orders.filter(
    (entry) => entry.kind === "MATERIAL" && !entry.cancelledAt,
  );
  return {
    id: row.id,
    payer: row.payer,
    student: {
      id: row.student.id,
      fullName: row.student.fullName,
      placements: academicPlacements(row.student, now),
    },
    agreedOn: toDateOnlyString(row.agreedOn!),
    startsOn: toDateOnlyString(row.startsOn!),
    endsOn: toDateOnlyString(row.endsOn!),
    monthlyAmountCents: row.monthlyAmountCents!,
    principalAmountCents:
      order.principalAmountCents +
      order.installments.reduce(
        (sum, row) => sum + renegotiatedInstallmentAmount(row) - row.amountCents,
        0,
      ),
    materialAmountCents: materialOrders.reduce((sum, entry) => sum + entry.principalAmountCents, 0),
    materials: materialOrders.map((entry) => ({
      id: entry.id,
      name: entry.material?.name ?? "Material",
      totalCents: entry.principalAmountCents,
      count: entry.installmentCount ?? entry.installments.length,
      installmentCents: uniformInstallmentAmount(entry),
    })),
    installmentCount: order.installmentCount!,
    uniformInstallmentAmountCents: uniformInstallmentAmount(order),
    firstDueDate: toDateOnlyString(order.firstDueDate!),
    ...deriveContractFinancialSummary({ ...order, now, installmentCount: order.installmentCount! }),
    ...(row.terminatedAt ? { status: "CANCELADO" as const } : {}),
    serviceStatus: row.terminatedAt
      ? "ENDED"
      : deriveContractServiceStatus({
          startsOn: toDateOnlyString(row.startsOn!),
          endsOn: toDateOnlyString(row.endsOn!),
          now,
        }),
  };
}

function requiredTuitionOrder(row: SelectedContract): SelectedContract["orders"][number] {
  const order = row.orders.find((entry) => entry.kind === "TUITION");
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
  return order;
}
