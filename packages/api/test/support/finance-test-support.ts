import assert from "node:assert/strict";

import { FINANCE_DUE_DAY_FIFTH } from "@lazuli/domain";

import { appRouter, createCaller, type Context, type StaffUser } from "@lazuli/api";
import { db } from "@lazuli/db";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

export const TEST_PREFIX = "GRE-43 ";
export const HTTP_OK = 200;
export const ENDPOINT = "/api/trpc";

export const ADMIN: StaffUser = {
  id: "00000000-0000-0000-0000-0000000000ad",
  name: "Admin de Teste",
  email: "admin@example.com",
  role: "ADMIN",
  isEnabled: true,
};

export type FinanceCaller = ReturnType<typeof createCaller>;

export function caller(): FinanceCaller {
  return createCaller(contextFor(ADMIN));
}

export function contextFor(staffUser: StaffUser | null, now?: Date): Context {
  return { db, staffUser, ...(now === undefined ? {} : { now }) };
}

export async function ensureAdminUser(): Promise<void> {
  await db.user.upsert({
    where: { id: ADMIN.id },
    create: {
      id: ADMIN.id,
      email: ADMIN.email,
      name: "GRE-43 Finance Admin",
      role: "ADMIN",
      isEnabled: true,
    },
    update: {},
  });
}

export async function createStudent(suffix: string, prefix = TEST_PREFIX): Promise<{ id: string }> {
  return db.student.create({
    data: { fullName: `${prefix}${suffix}`, status: "ACTIVE" },
    select: { id: true },
  });
}

export async function createPayer(suffix: string, prefix = TEST_PREFIX): Promise<{ id: string }> {
  return db.payer.create({
    data: { name: `${prefix}${suffix}` },
    select: { id: true },
  });
}

export async function cleanFinanceOrdersDatabase(prefix = TEST_PREFIX): Promise<void> {
  const payers = await db.payer.findMany({
    where: { name: { startsWith: prefix } },
    select: { id: true },
  });
  const payerIds = payers.map((row) => row.id);

  const students = await db.student.findMany({
    where: { fullName: { startsWith: prefix } },
    select: { id: true },
  });
  const studentIds = students.map((row) => row.id);

  const orders = await db.order.findMany({
    where: {
      OR: [
        { payerId: { in: payerIds } },
        { beneficiaries: { some: { studentId: { in: studentIds } } } },
      ],
    },
    select: { id: true },
  });
  const orderIds = orders.map((row) => row.id);

  const installments = await db.installment.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  const installmentIds = installments.map((row) => row.id);

  const paymentEntries = await db.paymentEntry.findMany({
    where: { payerId: { in: payerIds } },
    select: { id: true },
  });
  const paymentEntryIds = paymentEntries.map((row) => row.id);

  await db.paymentAllocation.deleteMany({
    where: {
      OR: [{ paymentEntryId: { in: paymentEntryIds } }, { installmentId: { in: installmentIds } }],
    },
  });
  await db.paymentEntry.deleteMany({ where: { id: { in: paymentEntryIds } } });
  await db.installmentAdjustment.deleteMany({ where: { installmentId: { in: installmentIds } } });
  await db.installment.deleteMany({ where: { id: { in: installmentIds } } });
  await db.orderBeneficiary.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  await db.payer.deleteMany({ where: { id: { in: payerIds } } });
  await db.student.deleteMany({ where: { id: { in: studentIds } } });
}

export async function callHttpMutation(input: {
  path: string;
  body: unknown;
  staffUser?: StaffUser | null;
}): Promise<Response> {
  return fetchRequestHandler({
    endpoint: ENDPOINT,
    req: new Request(`http://localhost${ENDPOINT}/${input.path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: input.body }),
    }),
    router: appRouter,
    createContext: () =>
      Promise.resolve(
        contextFor(Object.hasOwn(input, "staffUser") ? (input.staffUser ?? null) : ADMIN),
      ),
  });
}

export async function callHttpQuery(input: {
  path: string;
  body?: unknown;
  staffUser?: StaffUser | null;
  now?: Date;
}): Promise<Response> {
  const url = new URL(`http://localhost${ENDPOINT}/${input.path}`);
  if (input.body !== undefined) {
    url.searchParams.set("input", JSON.stringify({ json: input.body }));
  }

  return fetchRequestHandler({
    endpoint: ENDPOINT,
    req: new Request(url, { method: "GET" }),
    router: appRouter,
    createContext: () =>
      Promise.resolve(
        contextFor(
          Object.hasOwn(input, "staffUser") ? (input.staffUser ?? null) : ADMIN,
          input.now,
        ),
      ),
  });
}

export async function rejectionMessage(promise: Promise<unknown>): Promise<string> {
  return promise.then(
    () => {
      throw new Error("expected the operation to reject");
    },
    (error: unknown) => {
      assert.ok(error instanceof Error, "expected an Error");
      return error.message;
    },
  );
}

export const DEFAULT_ORDER_INPUT = {
  kind: "TUITION" as const,
  principalAmountCents: 100_000,
  installmentCount: 3,
  startDate: new Date("2026-01-03T00:00:00.000Z"),
  dueDay: FINANCE_DUE_DAY_FIFTH,
} as const;
