import type { Prisma } from "@lazuli/db";
import {
  deriveContractFinancialSummary,
  deriveContractServiceStatus,
  saoPauloDateOnly,
  type ContractFinancialStatus,
  type ContractFinancialSummary,
  type ContractServiceStatus,
} from "@lazuli/domain";

import { timeOnly } from "../../class-records/data.js";
import { toDateOnlyString } from "./shared.js";

export type ContractListRow = {
  plannedBooks?: Array<{
    semester: number;
    stageId: string | null;
    name: string | null;
    acquisitionSemester: number | null;
    acquired: boolean;
  }>;
  renewalPending?: boolean;
  materialDue?: string | null;
  id: string;
  payer: { id: string; name: string };
  student: {
    id: string;
    fullName: string;
    placements: Array<{
      stageCode: string;
      classCode: string;
      description?: string;
      modality?: string;
    }>;
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
    stageIds?: string[];
    paymentLabel?: string;
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
  plannedBooks: {
    orderBy: { semester: "asc" },
    select: {
      semester: true,
      stageId: true,
      acquisitionSemester: true,
      stage: { select: { name: true } },
    },
  },
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
          class: {
            select: {
              portalClassName: true,
              scheduleType: true,
              teacher: { select: { name: true } },
              scheduleSlots: {
                where: { deletedAt: null },
                orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
                select: { weekday: true, startTime: true, endTime: true },
              },
            },
          },
          progressRecords: {
            where: { deletedAt: null, endDate: null },
            select: { stage: { select: { internalCode: true, name: true } } },
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
} satisfies Prisma.ContractSelect;

export type SelectedContract = Prisma.ContractGetPayload<{ select: typeof contractSelect }>;

const weekdays = {
  MONDAY: "segunda-feira",
  TUESDAY: "terça-feira",
  WEDNESDAY: "quarta-feira",
  THURSDAY: "quinta-feira",
  FRIDAY: "sexta-feira",
  SATURDAY: "sábado",
  SUNDAY: "domingo",
};
const dayList = new Intl.ListFormat("pt-BR", { type: "conjunction" });

function classSchedule(
  slots: SelectedContract["student"]["enrollments"][number]["class"]["scheduleSlots"],
): string {
  const daysByTime = new Map<string, string[]>();
  for (const slot of slots) {
    const hours = `${timeOnly(slot.startTime)} às ${timeOnly(slot.endTime)}`;
    const days = daysByTime.get(hours) ?? [];
    days.push(weekdays[slot.weekday]);
    daysByTime.set(hours, days);
  }
  return Array.from(daysByTime, ([hours, days]) => `${dayList.format(days)}, das ${hours}`).join(
    " / ",
  );
}

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
        description: [
          progress.stage.name,
          classSchedule(enrollment.class.scheduleSlots),
          enrollment.class.teacher.name,
        ]
          .filter(Boolean)
          .join(" · "),
        stageCode: progress.stage.internalCode,
        classCode: enrollment.class.portalClassName,
        modality: enrollment.class.scheduleType === "PERSONALIZED" ? "PPT" : "Regular",
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
  const amounts = contractAmounts(order, { materialOrders, now });
  const tuition = tuitionDetails({ order, row, now });
  return {
    id: row.id,
    plannedBooks: row.plannedBooks.map((book) => ({
      semester: book.semester,
      stageId: book.stageId,
      name: book.stage?.name ?? null,
      acquisitionSemester: book.acquisitionSemester,
      acquired: materialOrders.some(
        (order) =>
          book.stageId &&
          (order.material?.stageId === book.stageId ||
            order.material?.items.some((item) => item.stageId === book.stageId)),
      ),
    })),
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

export function orderFinancialSummary(
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
  { materialOrders, now }: { materialOrders: SelectedContract["orders"]; now: Date },
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
    materials: materialOrders.map((entry) => materialSummary(entry, now)),
  };
}

function materialSummary(
  entry: SelectedContract["orders"][number],
  now: Date,
): ContractListRow["materials"][number] {
  const material = entry.material;
  return {
    stageIds: materialStageIds(material),
    id: entry.id,
    name: material?.items.map((item) => item.name).join(" + ") || material?.name || "Material",
    paymentLabel: materialPaymentLabel(entry, now),
    totalCents: entry.principalAmountCents,
    count: entry.installmentCount ?? entry.installments.length,
    installmentCents: uniformInstallmentAmount(entry),
  };
}

function materialStageIds(material: SelectedContract["orders"][number]["material"]): string[] {
  if (!material) return [];
  if (material.items.length > 0) return material.items.map((item) => item.stageId);
  return [material.stageId];
}

function materialPaymentLabel(entry: SelectedContract["orders"][number], now: Date): string {
  if (entry.principalAmountCents === 0) return "Sem cobrança";
  const { status } = orderFinancialSummary(entry, now);
  if (status === "QUITADO") return "Pago";
  return status === "SEM_SALDO" ? "Sem saldo" : "Não pago";
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
