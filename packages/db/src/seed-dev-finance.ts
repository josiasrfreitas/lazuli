import { randomUUID } from "node:crypto";
import type { DevStudentSeed } from "./seed-dev-data.js";
import {
  addDays,
  isoOf,
  requireValue,
  stableUuid,
  utcDate,
  type SeedContext,
} from "./seed-dev-support.js";

/**
 * Finance upserts for the dev seed: one TUITION order per student with an
 * order, monthly installments, and payments. "paid" students settle every
 * installment due so far; "overdue" students leave the most recent due
 * installment open.
 */

const YEAR_END_INDEX = 4;
const MONTH_START_INDEX = 5;
const MONTH_END_INDEX = 7;
const INSTALLMENT_COUNT = 5;
const INSTALLMENT_DUE_DAY = 10;
const PAYMENT_LEAD_DAYS = 2;
const LOCKED_DELETED_SCHEDULE_MESSAGE =
  "Cannot recreate a soft-deleted installment schedule with financial activity";

type FinanceInput = { studentSeed: DevStudentSeed; studentId: string };

export async function seedStudentFinance(context: SeedContext, input: FinanceInput): Promise<void> {
  const tuitionCents = requireValue(
    input.studentSeed.tuitionCents,
    `tuitionCents ${input.studentSeed.key}`,
  );
  const payerId = await upsertPayer(context, input.studentSeed);
  const orderId = stableUuid(["order", input.studentSeed.key]);
  await context.database.order.upsert({
    where: { id: orderId },
    create: {
      id: orderId,
      payerId,
      kind: "TUITION",
      principalAmountCents: tuitionCents * INSTALLMENT_COUNT,
      startDate: utcDate(context.semester.startIso),
      dueDay: INSTALLMENT_DUE_DAY,
    },
    update: {},
  });
  await context.database.orderBeneficiary.upsert({
    where: { orderId_studentId: { orderId, studentId: input.studentId } },
    create: { orderId, studentId: input.studentId },
    update: {},
  });
  await seedInstallments(context, {
    studentSeed: input.studentSeed,
    orderId,
    payerId,
    tuitionCents,
  });
}

async function upsertPayer(context: SeedContext, studentSeed: DevStudentSeed): Promise<string> {
  const contact = studentSeed.guardian ?? studentSeed;
  const id = stableUuid(["payer", studentSeed.key]);
  await context.database.payer.upsert({
    where: { id },
    create: {
      id,
      name: contact.fullName,
      phone: contact.phone ?? null,
      email: contact.email ?? null,
    },
    update: { name: contact.fullName },
  });
  return id;
}

type InstallmentsInput = {
  studentSeed: DevStudentSeed;
  orderId: string;
  payerId: string;
  tuitionCents: number;
};

async function seedInstallments(context: SeedContext, input: InstallmentsInput): Promise<void> {
  const installments = await loadOrCreateInstallments(context, input);
  const dueIsos = installments.map((installment) => isoOf(installment.dueDate));
  const dueSoFar = dueIsos.filter((dueIso) => dueIso <= context.todayIso);
  const paidIsos = new Set(input.studentSeed.finance === "paid" ? dueSoFar : dueSoFar.slice(0, -1));
  for (const installment of installments) {
    const dueIso = isoOf(installment.dueDate);
    if (paidIsos.has(dueIso)) {
      await payInstallment(context, {
        studentSeed: input.studentSeed,
        installmentId: installment.id,
        payerId: input.payerId,
        dueIso,
        amountCents: installment.amountCents,
      });
    }
  }
}

type SeededInstallment = { id: string; amountCents: number; dueDate: Date };

async function loadOrCreateInstallments(
  context: SeedContext,
  input: InstallmentsInput,
): Promise<SeededInstallment[]> {
  const existing = await loadInstallments(context, input.orderId);
  if (existing.length > 0) {
    return existing;
  }

  const dueIsos = installmentDueDates(context.semester.startIso);
  const deletedInstallment = await context.database.installment.findFirst({
    where: { orderId: input.orderId, deletedAt: { not: null } },
    select: { id: true },
  });
  if (deletedInstallment !== null) {
    const lockedInstallment = await context.database.installment.findFirst({
      where: {
        orderId: input.orderId,
        deletedAt: { not: null },
        OR: [
          { waivedAt: { not: null } },
          { allocations: { some: { deletedAt: null } } },
          { adjustments: { some: { deletedAt: null } } },
        ],
      },
      select: { id: true },
    });
    if (lockedInstallment !== null) {
      throw new Error(LOCKED_DELETED_SCHEDULE_MESSAGE);
    }
  }

  await context.database.installment.createMany({
    data: dueIsos.map((dueIso, index) => ({
      id:
        deletedInstallment === null
          ? stableUuid(["installment", input.studentSeed.key, dueIso])
          : randomUUID(),
      sequenceNumber: index + 1,
      orderId: input.orderId,
      amountCents: input.tuitionCents,
      dueDate: utcDate(dueIso),
    })),
  });
  return loadInstallments(context, input.orderId);
}

async function loadInstallments(
  context: SeedContext,
  orderId: string,
): Promise<SeededInstallment[]> {
  return context.database.installment.findMany({
    where: { orderId },
    orderBy: { dueDate: "asc" },
    select: { id: true, amountCents: true, dueDate: true },
  });
}

function installmentDueDates(startIso: string): string[] {
  const year = Number(startIso.slice(0, YEAR_END_INDEX));
  const monthIndex = Number(startIso.slice(MONTH_START_INDEX, MONTH_END_INDEX)) - 1;
  return Array.from({ length: INSTALLMENT_COUNT }, (_unused, index) =>
    isoOf(new Date(Date.UTC(year, monthIndex + index, INSTALLMENT_DUE_DAY))),
  );
}

type PaymentInput = {
  studentSeed: DevStudentSeed;
  installmentId: string;
  payerId: string;
  dueIso: string;
  amountCents: number;
};

async function payInstallment(context: SeedContext, input: PaymentInput): Promise<void> {
  const existingAllocation = await context.database.paymentAllocation.findFirst({
    where: { installmentId: input.installmentId },
    select: { id: true },
  });
  if (existingAllocation !== null) {
    return;
  }

  const paymentEntryId = stableUuid(["payment", input.studentSeed.key, input.installmentId]);
  await context.database.paymentEntry.upsert({
    where: { id: paymentEntryId },
    create: {
      id: paymentEntryId,
      payerId: input.payerId,
      date: addDays(utcDate(input.dueIso), -PAYMENT_LEAD_DAYS),
      amountCents: input.amountCents,
      method: "PIX",
    },
    update: {},
  });
  await context.database.paymentAllocation.upsert({
    where: {
      paymentEntryId_installmentId: { paymentEntryId, installmentId: input.installmentId },
    },
    create: {
      paymentEntryId,
      installmentId: input.installmentId,
      amountCents: input.amountCents,
    },
    update: {},
  });
}
