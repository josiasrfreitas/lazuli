import { sql } from "kysely";
import { saoPauloDateOnly } from "@lazuli/domain";
import type { FinanceDatabase } from "./shared.js";
import { ledgerQuery } from "./installments-query.js";

/** One actionable debt per contract, regardless of who pays for other students. */
export function readOverdueContracts(database: FinanceDatabase, now: Date) {
  return ledgerQuery({
    kysely: database.$kysely,
    businessDate: saoPauloDateOnly(now),
    search: undefined,
  })
    .selectFrom("ledger")
    .innerJoin("Order as source", "source.id", "ledger.orderId")
    .innerJoin("Contract as contract", "contract.id", "source.contract_id")
    .innerJoin("Student as student", "student.id", "contract.student_id")
    .where("ledger.status", "=", "OVERDUE")
    .where("contract.deleted_at", "is", null)
    .where("student.deleted_at", "is", null)
    .select([
      "contract.id as contractId",
      "student.id as studentId",
      "student.full_name as studentName",
      sql<number>`count(*)::integer`.as("installmentCount"),
      sql<number>`sum("ledger"."collectibleBalanceCents")::double precision`.as("balanceCents"),
      sql<number>`max("ledger"."overdueDays")::integer`.as("overdueDays"),
    ])
    .groupBy(["contract.id", "student.id", "student.full_name"])
    .orderBy("overdueDays", "desc")
    .orderBy("student.full_name", "asc")
    .orderBy("contract.id", "asc")
    .execute();
}
