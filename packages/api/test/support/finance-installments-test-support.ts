import {
  FINANCE_INSTALLMENTS_PAGE_SIZE,
  type FinanceInstallmentsInput,
  type FinanceInstallmentsOutput,
} from "@lazuli/validators";
import { db } from "@lazuli/db";

import { finance } from "../../src/finance/index.js";
import { ADMIN } from "./finance-test-support.js";

export const INSTALLMENTS_PREFIX = "Installments #53 ";
export const INSTALLMENTS_NOW = new Date("2026-03-01T03:30:00.000Z");
export const TEN_THOUSAND_CENTS = 10_000;
export const PARTIAL_FIRST_CENTS = 1000;
export const PARTIAL_SECOND_CENTS = 2000;
const DELETED_ALLOCATION_CENTS = 700;
const DELETED_PAYMENT_CENTS = 800;

export type InstallmentOrderFixture = {
  payerId: string;
  orderId: string;
  studentIds: string[];
  installmentIds: string[];
};

type OptionalFilters = Partial<
  Pick<
    FinanceInstallmentsInput,
    "statuses" | "dueFrom" | "dueTo" | "amountFromCents" | "amountToCents"
  >
>;

export async function readInstallments(
  input: {
    view: "overdue";
    page?: number;
    pageSize?: FinanceInstallmentsInput["pageSize"];
    search?: string;
    now?: Date;
  } & OptionalFilters,
): Promise<Extract<FinanceInstallmentsOutput, { view: "overdue" }>>;
export async function readInstallments(
  input: {
    view?: "all" | "paid";
    page?: number;
    pageSize?: FinanceInstallmentsInput["pageSize"];
    search?: string;
    now?: Date;
  } & OptionalFilters,
): Promise<Exclude<FinanceInstallmentsOutput, { view: "overdue" }>>;
export async function readInstallments(
  input: {
    view?: "all" | "paid" | "overdue";
    page?: number;
    pageSize?: FinanceInstallmentsInput["pageSize"];
    search?: string;
    now?: Date;
  } & OptionalFilters,
): Promise<FinanceInstallmentsOutput> {
  const { now, ...query } = input;
  return db.$transaction(
    (transaction) =>
      finance(transaction, ADMIN.id).installments(
        {
          ...query,
          view: input.view ?? "all",
          page: input.page ?? 1,
          pageSize: input.pageSize ?? FINANCE_INSTALLMENTS_PAGE_SIZE,
          search: input.search ?? INSTALLMENTS_PREFIX,
        },
        now ?? INSTALLMENTS_NOW,
      ),
    { isolationLevel: "RepeatableRead" },
  );
}

export async function createInstallmentOrder(
  input: {
    installmentCount?: number;
    amountCents?: number;
    dueDate?: string;
    payerName?: string;
    beneficiaryNames?: string[];
  } = {},
): Promise<InstallmentOrderFixture> {
  const installmentCount = input.installmentCount ?? 1;
  const amountCents = input.amountCents ?? TEN_THOUSAND_CENTS;
  const payer = await db.payer.create({
    data: { name: `${INSTALLMENTS_PREFIX}${input.payerName ?? crypto.randomUUID()}` },
  });
  const students = await createBeneficiaries(input.beneficiaryNames ?? [crypto.randomUUID()]);
  const order = await db.order.create({
    data: {
      payerId: payer.id,
      kind: "TUITION",
      principalAmountCents: amountCents * installmentCount,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      dueDay: 10,
      beneficiaries: { create: students.map((student) => ({ studentId: student.id })) },
      installments: {
        create: Array.from({ length: installmentCount }, (_unused, index) => ({
          sequenceNumber: index + 1,
          amountCents,
          dueDate: new Date(`${input.dueDate ?? "2026-04-10"}T00:00:00.000Z`),
        })),
      },
    },
    select: {
      id: true,
      installments: { select: { id: true }, orderBy: { sequenceNumber: "asc" } },
    },
  });
  return {
    payerId: payer.id,
    orderId: order.id,
    studentIds: students.map((student) => student.id),
    installmentIds: order.installments.map((installment) => installment.id),
  };
}

export async function allocateInstallment(input: {
  payerId: string;
  installmentId: string;
  amounts: number[];
}): Promise<Array<{ id: string; paymentEntryId: string }>> {
  return Promise.all(
    input.amounts.map(async (amountCents) => {
      const payment = await db.paymentEntry.create({
        data: { payerId: input.payerId, date: INSTALLMENTS_NOW, amountCents, method: "PIX" },
      });
      return db.paymentAllocation.create({
        data: { paymentEntryId: payment.id, installmentId: input.installmentId, amountCents },
        select: { id: true, paymentEntryId: true },
      });
    }),
  );
}

export async function createFinancialRulesFixture(): Promise<
  InstallmentOrderFixture & {
    partialId: string;
    paidId: string;
    waivedId: string;
    zeroExpectedId: string;
  }
> {
  const fixture = await createInstallmentOrder({
    installmentCount: 4,
    amountCents: TEN_THOUSAND_CENTS,
    dueDate: "2026-02-28",
    beneficiaryNames: ["Ana Visível", "Bia Visível"],
  });
  const [partialId = "", paidId = "", waivedId = "", zeroExpectedId = ""] = fixture.installmentIds;
  await db.installmentAdjustment.createMany({
    data: [
      { installmentId: partialId, type: "DISCOUNT", amountCents: -400, reason: "desconto" },
      { installmentId: partialId, type: "DISCOUNT", amountCents: -600, reason: "desconto" },
      {
        installmentId: zeroExpectedId,
        type: "DISCOUNT",
        amountCents: -TEN_THOUSAND_CENTS,
        reason: "bolsa",
      },
    ],
  });
  await allocateInstallment({
    payerId: fixture.payerId,
    installmentId: partialId,
    amounts: [PARTIAL_FIRST_CENTS, PARTIAL_SECOND_CENTS],
  });
  await allocateInstallment({
    payerId: fixture.payerId,
    installmentId: paidId,
    amounts: [TEN_THOUSAND_CENTS],
  });
  await allocateInstallment({
    payerId: fixture.payerId,
    installmentId: waivedId,
    amounts: [TEN_THOUSAND_CENTS],
  });
  await db.installment.update({
    where: { id: waivedId },
    data: { waivedAt: INSTALLMENTS_NOW, waivedReason: "isenção" },
  });
  return { ...fixture, partialId, paidId, waivedId, zeroExpectedId };
}

export async function createVisibilityFixture(): Promise<{
  activeOrderId: string;
  excludedOrderIds: string[];
}> {
  const active = await createInstallmentOrder({
    beneficiaryNames: ["Ativa", "Vínculo excluído", "Aluna excluída"],
  });
  const deletedInstallment = await createInstallmentOrder({ payerName: "Parcela excluída" });
  const deletedOrder = await createInstallmentOrder({ payerName: "Pedido excluído" });
  const deletedPayer = await createInstallmentOrder({ payerName: "Pagador excluído" });
  const cancelledOrder = await createInstallmentOrder({ payerName: "Pedido cancelado" });
  await hideVisibilityRelations({
    active,
    deletedInstallment,
    deletedOrder,
    deletedPayer,
    cancelledOrder,
  });
  return {
    activeOrderId: active.orderId,
    excludedOrderIds: [
      deletedInstallment.orderId,
      deletedOrder.orderId,
      deletedPayer.orderId,
      cancelledOrder.orderId,
    ],
  };
}

async function hideVisibilityRelations(input: {
  active: InstallmentOrderFixture;
  deletedInstallment: InstallmentOrderFixture;
  deletedOrder: InstallmentOrderFixture;
  deletedPayer: InstallmentOrderFixture;
  cancelledOrder: InstallmentOrderFixture;
}): Promise<void> {
  const activeInstallmentId = input.active.installmentIds[0] ?? "";
  const deletedInstallmentId = input.deletedInstallment.installmentIds[0] ?? "";
  const deletedLinkStudentId = input.active.studentIds[1] ?? "";
  const deletedStudentId = input.active.studentIds[2] ?? "";
  const adjustment = await db.installmentAdjustment.create({
    data: {
      installmentId: activeInstallmentId,
      type: "DISCOUNT",
      amountCents: -500,
      reason: "apagado",
    },
  });
  const allocations = await allocateInstallment({
    payerId: input.active.payerId,
    installmentId: activeInstallmentId,
    amounts: [DELETED_ALLOCATION_CENTS, DELETED_PAYMENT_CENTS],
  });
  const deletedAllocationId = allocations[0]?.id ?? "";
  const deletedPaymentId = allocations[1]?.paymentEntryId ?? "";
  await db.installmentAdjustment.update({
    where: { id: adjustment.id },
    data: { deletedAt: INSTALLMENTS_NOW },
  });
  await db.paymentAllocation.update({
    where: { id: deletedAllocationId },
    data: { deletedAt: INSTALLMENTS_NOW },
  });
  await db.paymentEntry.update({
    where: { id: deletedPaymentId },
    data: { deletedAt: INSTALLMENTS_NOW },
  });
  await hideEntityRelations({
    ...input,
    deletedInstallmentId,
    deletedLinkStudentId,
    deletedStudentId,
  });
}

async function hideEntityRelations(input: {
  active: InstallmentOrderFixture;
  deletedInstallment: InstallmentOrderFixture;
  deletedOrder: InstallmentOrderFixture;
  deletedPayer: InstallmentOrderFixture;
  cancelledOrder: InstallmentOrderFixture;
  deletedInstallmentId: string;
  deletedLinkStudentId: string;
  deletedStudentId: string;
}): Promise<void> {
  await db.installment.update({
    where: { id: input.deletedInstallmentId },
    data: { deletedAt: INSTALLMENTS_NOW },
  });
  await db.order.update({
    where: { id: input.deletedOrder.orderId },
    data: { deletedAt: INSTALLMENTS_NOW },
  });
  await db.payer.update({
    where: { id: input.deletedPayer.payerId },
    data: { deletedAt: INSTALLMENTS_NOW },
  });
  await db.orderBeneficiary.update({
    where: {
      orderId_studentId: {
        orderId: input.active.orderId,
        studentId: input.deletedLinkStudentId,
      },
    },
    data: { deletedAt: INSTALLMENTS_NOW },
  });
  await db.student.update({
    where: { id: input.deletedStudentId },
    data: { deletedAt: INSTALLMENTS_NOW },
  });
  await db.order.update({
    where: { id: input.cancelledOrder.orderId },
    data: { cancelledAt: INSTALLMENTS_NOW, cancelledReason: "teste" },
  });
}

async function createBeneficiaries(names: string[]): Promise<Array<{ id: string }>> {
  return Promise.all(
    names.map((name) =>
      db.student.create({
        data: { fullName: `${INSTALLMENTS_PREFIX}${name}`, status: "ACTIVE" },
        select: { id: true },
      }),
    ),
  );
}

export async function cleanInstallmentsTestData(): Promise<void> {
  const pattern = `${INSTALLMENTS_PREFIX}%`;
  await db.$executeRaw`delete from "PaymentAllocation" where payment_entry_id in (
    select id from "PaymentEntry" where payer_id in (select id from "Payer" where name like ${pattern})
  ) or installment_id in (
    select id from "Installment" where order_id in (
      select id from "Order" where payer_id in (select id from "Payer" where name like ${pattern})
    )
  )`;
  await db.$executeRaw`delete from "InstallmentAdjustment" where installment_id in (
    select id from "Installment" where order_id in (
      select id from "Order" where payer_id in (select id from "Payer" where name like ${pattern})
    )
  )`;
  await db.$executeRaw`delete from "PaymentEntry" where payer_id in (
    select id from "Payer" where name like ${pattern}
  )`;
  await db.$executeRaw`delete from "Installment" where order_id in (
    select id from "Order" where payer_id in (select id from "Payer" where name like ${pattern})
  )`;
  await db.$executeRaw`delete from "OrderBeneficiary" where order_id in (
    select id from "Order" where payer_id in (select id from "Payer" where name like ${pattern})
  )`;
  await db.$executeRaw`delete from "Order" where payer_id in (
    select id from "Payer" where name like ${pattern}
  )`;
  await db.$executeRaw`delete from "Payer" where name like ${pattern}`;
  await db.$executeRaw`delete from "Student" where full_name like ${pattern}`;
}
