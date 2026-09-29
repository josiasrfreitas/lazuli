import type { FinanceDatabase } from "./shared.js";

function partySearchWhere(
  query: string,
  field: "name" | "fullName",
): {
  deletedAt: null;
  OR: Array<{
    id?: string;
    name?: { contains: string; mode: "insensitive" };
    fullName?: { contains: string; mode: "insensitive" };
  }>;
} {
  const exactId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query)
    ? query
    : null;
  return {
    deletedAt: null,
    OR: [
      { [field]: { contains: query, mode: "insensitive" as const } },
      ...(exactId ? [{ id: exactId }] : []),
    ],
  };
}

function findContractStudents(
  database: FinanceDatabase,
  query: string,
): Promise<
  Array<{
    id: string;
    fullName: string;
    documentNumber: string | null;
  }>
> {
  return database.student.findMany({
    where: partySearchWhere(query, "fullName"),
    select: { id: true, fullName: true, documentType: true, documentNumber: true },
    orderBy: { fullName: "asc" },
    take: 20,
  });
}

function findContractPayers(
  database: FinanceDatabase,
  query: string,
): Promise<
  Array<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    documentType: string | null;
    documentNumber: string | null;
  }>
> {
  return database.payer.findMany({
    where: partySearchWhere(query, "name"),
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      documentType: true,
      documentNumber: true,
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 20,
  });
}

export async function searchContractParties(
  database: FinanceDatabase,
  query: string,
): Promise<{
  students: Array<{ id: string; name: string; document: string | null }>;
  payers: Array<{ id: string; name: string; document: string | null; detail: string }>;
}> {
  const [students, payers] = await Promise.all([
    findContractStudents(database, query),
    findContractPayers(database, query),
  ]);
  return {
    students: students.map((row) => ({
      id: row.id,
      name: row.fullName,
      document: row.documentNumber,
    })),
    payers: payers.map((row) => ({
      id: row.id,
      name: row.name,
      document: row.documentNumber,
      detail: [
        row.documentType && row.documentNumber ? `${row.documentType} ${row.documentNumber}` : null,
        row.phone,
        row.email,
      ]
        .filter(Boolean)
        .join(" · "),
    })),
  };
}
