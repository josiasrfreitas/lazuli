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
  baseMonthlyAmountCents: number;
  scholarshipPct: number;
  scholarshipAgreement: string | null;
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
  baseMonthlyAmountCents: true,
  scholarshipPct: true,
  scholarshipAgreement: true,
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
            select: {
              amountCents: true,
              reversals: {
                where: { deletedAt: null, reversal: { deletedAt: null } },
                select: { amountCents: true },
              },
            },
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
  const amounts = contractAmounts(order, materialOrders);
  const tuition = tuitionDetails({ order, row, now });
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
    baseMonthlyAmountCents: row.baseMonthlyAmountCents ?? row.monthlyAmountCents!,
    scholarshipPct: Number(row.scholarshipPct),
    scholarshipAgreement: row.scholarshipAgreement,
    ...amounts,
    ...tuition,
    ...(row.terminatedAt ? { status: "CANCELADO" as const } : {}),
    serviceStatus: contractServiceStatus(row, now),
  };
}

function tuitionDetails({
  order,
  row,
  now,
}: {
  order: SelectedContract["orders"][number] | undefined;
  row: SelectedContract;
  now: Date;
}): Pick<
  ContractListRow,
  | "installmentCount"
  | "uniformInstallmentAmountCents"
  | "firstDueDate"
  | "status"
  | "paymentProgress"
  | "financialSummary"
> {
  return {
    installmentCount: order?.installmentCount ?? 0,
    uniformInstallmentAmountCents: order ? uniformInstallmentAmount(order) : null,
    firstDueDate: toDateOnlyString(order?.firstDueDate ?? row.startsOn!),
    ...orderFinancialSummary(order, now),
  };
}

function orderFinancialSummary(
  order: SelectedContract["orders"][number] | undefined,
  now: Date,
): ReturnType<typeof deriveContractFinancialSummary> {
  return deriveContractFinancialSummary({
    cancelledAt: order?.cancelledAt ?? null,
    installments:
      order?.installments.map((installment) => ({
        ...installment,
        allocations: installment.allocations.map((allocation) => ({
          amountCents:
            allocation.amountCents -
            allocation.reversals.reduce((total, reversal) => total + reversal.amountCents, 0),
        })),
      })) ?? [],
    now,
    installmentCount: order?.installmentCount ?? 0,
  });
}

function contractAmounts(
  order: SelectedContract["orders"][number] | undefined,
  materialOrders: SelectedContract["orders"],
): Pick<ContractListRow, "principalAmountCents" | "materialAmountCents" | "materials"> {
  return {
    principalAmountCents:
      (order?.principalAmountCents ?? 0) +
      (order?.installments ?? []).reduce(
        (sum, installment) =>
          sum + renegotiatedInstallmentAmount(installment) - installment.amountCents,
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
  };
}

function contractServiceStatus(row: SelectedContract, now: Date): ContractListRow["serviceStatus"] {
  if (row.terminatedAt) return "ENDED";
  return deriveContractServiceStatus({
    startsOn: toDateOnlyString(row.startsOn!),
    endsOn: toDateOnlyString(row.endsOn!),
    now,
  });
}

function requiredTuitionOrder(
  row: SelectedContract,
): SelectedContract["orders"][number] | undefined {
  const order = row.orders.find((entry) => entry.kind === "TUITION");
  if (!order && isFreeScholarship(row)) return undefined;
  if (!order || !completeTuition(row, order)) throw new Error("Contrato mensal incompleto.");
  return order;
}

const FULL_SCHOLARSHIP_PCT = 100;
function isFreeScholarship(row: SelectedContract): boolean {
  return Boolean(
    Number(row.scholarshipPct) === FULL_SCHOLARSHIP_PCT &&
    row.monthlyAmountCents === 0 &&
    row.agreedOn &&
    row.startsOn &&
    row.endsOn,
  );
}

function completeTuition(
  row: SelectedContract,
  order: SelectedContract["orders"][number],
): boolean {
  return Boolean(
    row.agreedOn &&
    row.startsOn &&
    row.endsOn &&
    row.monthlyAmountCents !== null &&
    order.firstDueDate &&
    order.installmentCount !== null,
  );
}
