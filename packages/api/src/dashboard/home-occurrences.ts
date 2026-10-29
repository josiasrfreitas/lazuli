import type { Prisma, TransactionClient } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import { linkItem, type HomeItem } from "./home-model.js";

export async function readOccurrencePending(
  database: TransactionClient,
  page: { skip: number; take: number },
): Promise<{ total: number; items: HomeItem[] }> {
  const where: Prisma.PedagogicalOccurrenceWhereInput = {
    deletedAt: null,
    status: { in: ["OPEN", "FOLLOWING_UP"] },
    student: { deletedAt: null },
  };
  const [total, rows] = await Promise.all([
    database.pedagogicalOccurrence.count({ where }),
    database.pedagogicalOccurrence.findMany({
      where,
      ...page,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        status: true,
        studentId: true,
        createdAt: true,
        student: { select: { fullName: true } },
      },
    }),
  ]);
  return {
    total,
    items: rows.map((row) =>
      linkItem({
        id: row.id,
        title: row.student.fullName,
        detail: `${row.status === "OPEN" ? "Aberta" : "Em acompanhamento"} · ${row.title}`,
        date: saoPauloDateOnly(row.createdAt),
        href: `/alunos/${row.studentId}?secao=pedagogico&registro=occurrence%3A${row.id}&voltar=%2F#acompanhamento`,
      }),
    ),
  };
}
