import type { Prisma } from "@lazuli/db";

/** Resolve identifiers, never names: one payer may pay for several students. */
export async function studentFinancialActivityScope(
  database: Prisma.TransactionClient,
  studentId: string,
): Promise<Prisma.ActivityEventWhereInput> {
  const [contracts, orders] = await Promise.all([
    database.contract.findMany({ where: { studentId }, select: { id: true, payerId: true } }),
    database.order.findMany({
      where: { OR: [{ contract: { studentId } }, { beneficiaries: { some: { studentId } } }] },
      select: { id: true, payerId: true },
    }),
  ]);
  const orderIds = orders.map((row) => row.id);
  const [payments, agreements] = await Promise.all([
    database.paymentEntry.findMany({
      where: { allocations: { some: { installment: { orderId: { in: orderIds } } } } },
      select: { id: true, operationId: true },
    }),
    database.installmentAgreement.findMany({
      where: { installment: { orderId: { in: orderIds } } },
      select: { commandId: true },
    }),
  ]);
  const reversals = await database.paymentReversal.findMany({
    where: { paymentEntryId: { in: payments.map((row) => row.id) } },
    select: { id: true },
  });
  const keys = financialKeys(payments, agreements, reversals);
  return {
    area: "FINANCIAL",
    OR: [
      { subjectType: "student", subjectId: studentId },
      { subjectType: "contract", subjectId: { in: contracts.map((row) => row.id) } },
      { subjectType: "receivable", subjectId: { in: orderIds } },
      {
        action: "finance.createPayer",
        subjectType: "payer",
        subjectId: {
          in: [
            ...new Set(
              [...contracts, ...orders].flatMap((row) => (row.payerId ? [row.payerId] : [])),
            ),
          ],
        },
      },
      { deduplicationKey: { in: [...new Set(keys)] } },
      ...payments.map((row) => ({
        action: "finance.batchReconcile",
        deduplicationKey: { contains: row.id },
      })),
    ],
  };
}

function financialKeys(
  payments: { id: string; operationId: string | null }[],
  agreements: { commandId: string }[],
  reversals: { id: string }[],
): string[] {
  return [
    ...payments.map((row) => `finance.registerPayment:${row.id}`),
    ...payments.flatMap((row) =>
      row.operationId ? [`finance.confirmPayments:${row.operationId}`] : [],
    ),
    ...agreements.map((row) => `finance.treatment:${row.commandId}`),
    ...reversals.map((row) => `finance.reversePayment:${row.id}`),
  ];
}
