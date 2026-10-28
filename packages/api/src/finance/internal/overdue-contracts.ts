import { sql } from "kysely";
import { saoPauloDateOnly } from "@lazuli/domain";
import type { FinanceDatabase } from "./shared.js";
import { ledgerQuery } from "./installments-query.js";

const STUDENT_NAME_COLUMN = "student.full_name";
const CONTRACT_ID_COLUMN = "contract.id";
export type OverdueContract = {
  contractId: string;
  studentId: string;
  studentName: string;
  installmentCount: number;
  balanceCents: number;
  overdueDays: number;
};

/** One actionable debt per contract, regardless of who pays for other students. */
export function readOverdueContracts(
  database: FinanceDatabase,
  now: Date,
): Promise<OverdueContract[]> {
  return ledgerQuery({
    kysely: database.$kysely,
    businessDate: saoPauloDateOnly(now),
    search: undefined,
  })
    .selectFrom("ledger")
    .innerJoin("Order as source", "source.id", "ledger.orderId")
    .innerJoin("Contract as contract", CONTRACT_ID_COLUMN, "source.contract_id")
    .innerJoin("Student as student", "student.id", "contract.student_id")
    .where("ledger.status", "=", "OVERDUE")
    .where("contract.deleted_at", "is", null)
    .where("student.deleted_at", "is", null)
    .select([
      `${CONTRACT_ID_COLUMN} as contractId`,
      "student.id as studentId",
      `${STUDENT_NAME_COLUMN} as studentName`,
      sql<number>`count(*)::integer`.as("installmentCount"),
      sql<number>`sum("ledger"."collectibleBalanceCents")::double precision`.as("balanceCents"),
      sql<number>`max("ledger"."overdueDays")::integer`.as("overdueDays"),
    ])
    .groupBy([CONTRACT_ID_COLUMN, "student.id", STUDENT_NAME_COLUMN])
    .orderBy("overdueDays", "desc")
    .orderBy(STUDENT_NAME_COLUMN, "asc")
    .orderBy(CONTRACT_ID_COLUMN, "asc")
    .execute();
}
