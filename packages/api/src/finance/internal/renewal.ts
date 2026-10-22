import type { FinanceDatabase } from "./shared.js";
import type { Prisma } from "@lazuli/db";
import { badRequest, notFound } from "../../trpc/errors.js";

const ISO_DATE_LENGTH = 10;
const renewalInclude = {
  student: { select: { id: true, fullName: true } },
  payer: { select: { id: true, name: true } },
  orders: {
    where: { kind: "TUITION", deletedAt: null, cancelledAt: null },
    take: 1,
    select: { installmentCount: true, dueDay: true },
  },
} satisfies Prisma.ContractInclude;
type RenewalRow = Prisma.ContractGetPayload<{ include: typeof renewalInclude }>;
type RenewalTerms = {
  id: string;
  updatedAt: Date;
  student: RenewalRow["student"];
  payer: RenewalRow["payer"];
  endsOn: string;
  durationMonths: number;
  monthlyAmountCents: number;
  installmentCount: number;
  dueDay: number;
  offer: {
    tuitionCeilingCents: number;
    maximumDiscountPct: number;
    punctualityDiscountPct: number;
    interestRatePctDaily: number;
    interestRatePctMonthly: number;
    cancellationFeePct: number;
  };
};

export async function renewalTerms(
  database: FinanceDatabase,
  contractId: string,
): Promise<RenewalTerms> {
  const row = await database.contract.findFirst({
    where: { id: contractId, deletedAt: null, terminatedAt: null },
    include: renewalInclude,
  });
  if (!row) throw notFound("Contrato não encontrado ou encerrado.");
  assertRenewalReady(row);
  const existing = await database.contract.findFirst({
    where: { renewedFromId: row.id, deletedAt: null, terminatedAt: null },
    select: { id: true },
  });
  if (existing) throw badRequest("Este contrato já foi renovado. Consulte os contratos do aluno.");
  return projectRenewal(row);
}

function assertRenewalReady(row: RenewalRow): void {
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
}

function projectRenewal(row: RenewalRow): RenewalTerms {
  return {
    id: row.id,
    updatedAt: row.updatedAt,
    student: row.student,
    payer: row.payer,
    endsOn: row.endsOn!.toISOString().slice(0, ISO_DATE_LENGTH),
    durationMonths: row.durationMonths!,
    monthlyAmountCents: row.monthlyAmountCents!,
    installmentCount: row.orders[0]?.installmentCount ?? row.durationMonths!,
    dueDay: row.orders[0]?.dueDay ?? row.endsOn!.getUTCDate(),
    offer: {
      tuitionCeilingCents: row.tuitionCeilingCents!,
      maximumDiscountPct: Number(row.maximumDiscountPct),
      punctualityDiscountPct: Number(row.punctualityDiscountPct),
      interestRatePctDaily: Number(row.interestRatePctDaily),
      interestRatePctMonthly: Number(row.interestRatePctMonthly),
      cancellationFeePct: Number(row.cancellationFeePct),
    },
  };
}
