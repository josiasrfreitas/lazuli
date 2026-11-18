import type { Prisma } from "@lazuli/db";
import type { FinanceDatabase } from "./shared.js";

export function studentMaterialSaleWhere(studentIds: string[]): Prisma.MaterialOrderWhereInput {
  return {
    order: {
      deletedAt: null,
      cancelledAt: null,
      contract: { studentId: { in: studentIds }, deletedAt: null },
    },
  };
}

/** Older orders stored a single book directly on the sale; newer orders have item lines. */
export function purchasedBooks<Book>(items: Book[], legacyBook: Book): Book[] {
  return items.length ? items : [legacyBook];
}

export async function readAcquiredStages(
  database: Pick<FinanceDatabase, "materialOrder">,
  studentIds: string[],
) {
  const sales = await database.materialOrder.findMany({
    where: studentMaterialSaleWhere(studentIds),
    select: {
      stageId: true,
      items: { select: { stageId: true } },
      order: { select: { contract: { select: { studentId: true } } } },
    },
  });
  const byStudent = new Map<string, Set<string>>();
  for (const sale of sales) {
    const id = sale.order.contract?.studentId;
    if (!id) continue;
    const stages = byStudent.get(id) ?? new Set<string>();
    for (const book of purchasedBooks(sale.items, { stageId: sale.stageId }))
      stages.add(book.stageId);
    byStudent.set(id, stages);
  }
  return byStudent;
}
