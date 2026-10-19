import type { FinanceDatabase } from "./shared.js";
import { badRequest, notFound } from "../../trpc/errors.js";

export async function renewalTerms(database: FinanceDatabase, contractId: string) {
  const row = await database.contract.findFirst({
    where: { id: contractId, deletedAt: null, terminatedAt: null },
    include: {
      student: { select: { id: true, fullName: true } },
      payer: { select: { id: true, name: true } },
      orders: {
        where: { kind: "TUITION", deletedAt: null, cancelledAt: null },
        take: 1,
        select: { installmentCount: true, dueDay: true },
      },
    },
  });
  if (!row) throw notFound("Contrato não encontrado ou encerrado.");
  if (
    !row.endsOn ||
    !row.durationMonths ||
    !row.monthlyAmountCents ||
    row.tuitionCeilingCents === null ||
    row.maximumDiscountPct === null ||
    row.punctualityDiscountPct === null ||
    row.interestRatePctDaily === null ||
    row.interestRatePctMonthly === null ||
    row.cancellationFeePct === null
  )
    throw badRequest(
      "Este contrato não tem todos os termos registrados. Revise-o no financeiro antes de renovar.",
    );
  const existing = await database.contract.findFirst({
    where: { renewedFromId: row.id, deletedAt: null, terminatedAt: null },
    select: { id: true },
  });
  if (existing) throw badRequest("Este contrato já foi renovado. Consulte os contratos do aluno.");
  return {
    id: row.id,
    updatedAt: row.updatedAt,
    student: row.student,
    payer: row.payer,
    endsOn: row.endsOn.toISOString().slice(0, 10),
    durationMonths: row.durationMonths,
    monthlyAmountCents: row.monthlyAmountCents,
    installmentCount: row.orders[0]?.installmentCount ?? row.durationMonths,
    dueDay: row.orders[0]?.dueDay ?? row.endsOn.getUTCDate(),
    offer: {
      tuitionCeilingCents: row.tuitionCeilingCents,
      maximumDiscountPct: Number(row.maximumDiscountPct),
      punctualityDiscountPct: Number(row.punctualityDiscountPct),
      interestRatePctDaily: Number(row.interestRatePctDaily),
      interestRatePctMonthly: Number(row.interestRatePctMonthly),
      cancellationFeePct: Number(row.cancellationFeePct),
    },
  };
}
