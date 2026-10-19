import { searchIds } from "../../search.js";
import type { FinanceDatabase } from "./shared.js";

async function partySearchWhere(
  database: FinanceDatabase,
  query: string,
  table: "Student" | "Payer",
) {
  const exactId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);
  const matches = await searchIds(database, table, query);
  return {
    deletedAt: null,
    ...(matches ? { OR: [{ id: matches }, ...(exactId ? [{ id: query }] : [])] } : {}),
  };
}

async function findContractStudents(
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
    where: await partySearchWhere(database, query, "Student"),
    select: { id: true, fullName: true, documentType: true, documentNumber: true },
    orderBy: { fullName: "asc" },
    take: 20,
  });
}

async function findContractPayers(
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
    where: await partySearchWhere(database, query, "Payer"),
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
