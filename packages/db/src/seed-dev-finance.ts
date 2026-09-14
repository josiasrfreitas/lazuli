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
 * installment open. Re-running is supported only for unchanged fixtures in the
 * same semester. After product edits, deletions, or a semester change, use
 * `pnpm db:reset`; this seed does not reconcile existing financial history.
 */

const YEAR_END_INDEX = 4;
const MONTH_START_INDEX = 5;
const MONTH_END_INDEX = 7;
const INSTALLMENT_COUNT = 5;
const INSTALLMENT_DUE_DAY = 10;
const PAYMENT_LEAD_DAYS = 2;

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
  const dueIsos = installmentDueDates(context.semester.startIso);
  const dueSoFar = dueIsos.filter((dueIso) => dueIso <= context.todayIso);
  const paidIsos = new Set(input.studentSeed.finance === "paid" ? dueSoFar : dueSoFar.slice(0, -1));
  for (const [index, dueIso] of dueIsos.entries()) {
    const installmentId = stableUuid(["installment", input.studentSeed.key, dueIso]);
    await context.database.installment.upsert({
      where: { id: installmentId },
      create: {
        id: installmentId,
        sequenceNumber: index + 1,
        orderId: input.orderId,
        amountCents: input.tuitionCents,
        dueDate: utcDate(dueIso),
      },
      update: {},
    });
    if (paidIsos.has(dueIso)) {
      await payInstallment(context, {
        studentSeed: input.studentSeed,
        installmentId,
        payerId: input.payerId,
        dueIso,
        amountCents: input.tuitionCents,
      });
    }
  }
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
