import type { Prisma, TransactionClient } from "@lazuli/db";
import { HEALTH_RECOVERY_MS, saoPauloDateOnly } from "@lazuli/domain";
import { linkItem, type HomeItem } from "./home-model.js";

export async function readHealthPending(
  database: TransactionClient,
  { now, skip, take }: { now: Date; skip: number; take: number },
): Promise<{ total: number; items: HomeItem[] }> {
  const where: Prisma.StudentHealthPendingWhereInput = {
    deletedAt: null,
    openedAt: { not: null },
    score: { not: null },
    student: { deletedAt: null, status: "ACTIVE" },
    OR: [
      { recoveredAt: null },
      { recoveredAt: { gt: new Date(now.getTime() - HEALTH_RECOVERY_MS) } },
    ],
  };
  const [total, rows] = await Promise.all([
    database.studentHealthPending.count({ where }),
    database.studentHealthPending.findMany({
      where,
      skip,
      take,
      orderBy: [{ score: "asc" }, { openedAt: "asc" }, { id: "asc" }],
      include: { student: { select: { fullName: true } } },
    }),
  ]);
  return {
    total,
    items: rows.map((row) =>
      linkItem({
        id: row.studentId,
        title: row.student.fullName,
        detail: `Score ${row.score}/100 · ${row.recoveredAt ? "Em observação" : "Abaixo de 70"}`,
        date: row.recoveredAt
          ? saoPauloDateOnly(new Date(row.recoveredAt.getTime() + HEALTH_RECOVERY_MS))
          : null,
        href: `/alunos/${row.studentId}?secao=visao-geral&voltar=%2F`,
      }),
    ),
  };
}
