import type { Prisma } from "@lazuli/db";
import type { FormationCaseInput } from "@lazuli/validators";
import { badRequest } from "../../trpc/errors.js";
import type { FinanceDatabase } from "./shared.js";

export async function requireStudentAgreement(
  database: FinanceDatabase,
  {
    studentId,
    reference,
  }: {
    studentId: string;
    reference: Extract<FormationCaseInput, { kind: "AGREEMENT" }>["reference"];
  },
): Promise<void> {
  const { id, type } = reference;
  const exists =
    type === "renewal"
      ? await database.contract.count({
          where: { id, studentId, deletedAt: null, renewedFromId: { not: null } },
        })
      : await database.contractRenegotiation.count({
          where: { id, deletedAt: null, contract: { studentId, deletedAt: null } },
        });
  if (!exists) throw badRequest("Escolha um registro financeiro deste aluno.");
}

type Agreements = {
  agreements: Pick<
    Prisma.ContractRenegotiationGetPayload<object>,
    "id" | "effectiveDate" | "newAmountCents" | "installmentCount" | "reason" | "actorName"
  >[];
  renewals: Pick<
    Prisma.ContractGetPayload<object>,
    "id" | "startsOn" | "endsOn" | "monthlyAmountCents"
  >[];
};
export async function readStudentAgreements(
  database: FinanceDatabase,
  studentId: string,
): Promise<Agreements> {
  const contract = { studentId, deletedAt: null };
  const [agreements, renewals] = await Promise.all([
    database.contractRenegotiation.findMany({
      where: { deletedAt: null, contract },
      select: {
        id: true,
        effectiveDate: true,
        newAmountCents: true,
        installmentCount: true,
        reason: true,
        actorName: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    database.contract.findMany({
      where: { ...contract, renewedFromId: { not: null } },
      select: { id: true, startsOn: true, endsOn: true, monthlyAmountCents: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { agreements, renewals };
}
