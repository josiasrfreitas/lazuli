import type { Student } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import { sql } from "kysely";
import { ledgerQuery } from "./installments-query.js";
import type { FinanceDatabase } from "./shared.js";

type OverdueStudent = {
  id: string;
  name: string;
  status: Student["status"];
  balance: number;
  days: number;
  lastNotice: string | null;
  score: number | null;
  attendance: number | null;
};
export function overdueStudents(db: FinanceDatabase, now: Date): Promise<OverdueStudent[]> {
  const today = saoPauloDateOnly(now);
  return ledgerQuery({ kysely: db.$kysely, businessDate: today, search: undefined })
    .selectFrom("ledger")
    .innerJoin("Order as o", "o.id", "ledger.orderId")
    .innerJoin("Contract as c", "c.id", "o.contract_id")
    .innerJoin("Student as s", "s.id", "c.student_id")
    .innerJoin("Installment as i", "i.id", "ledger.installmentId")
    .where("ledger.status", "=", "OVERDUE")
    .where("s.deleted_at", "is", null)
    .where("c.deleted_at", "is", null)
    .select([
      "s.id as id",
      "s.full_name as name",
      "s.status as status",
      sql<number>`sum("collectibleBalanceCents")::float8`.as("balance"),
      sql<number>`max("overdueDays")::int`.as("days"),
      sql<
        string | null
      >`(max(i.overdue_d30_email_sent_at) at time zone 'America/Sao_Paulo')::date::text`.as(
        "lastNotice",
      ),
      sql<
        number | null
      >`(select score from "StudentHealthPending" h where h.student_id=s.id and h.deleted_at is null)`.as(
        "score",
      ),
      sql<
        number | null
      >`(select avg((a.status='PRESENT')::int)::float8 from "Attendance" a join "Enrollment" e on e.id=a.enrollment_id join "ClassSession" cs on cs.id=a.class_session_id where e.student_id=s.id and e.deleted_at is null and a.deleted_at is null and cs.deleted_at is null and cs.status<>'CANCELLED' and cs.attendance_confirmed_at is not null and cs.date between ${today}::date-29 and ${today}::date)`.as(
        "attendance",
      ),
    ])
    .groupBy(["s.id", "s.full_name", "s.status"])
    .orderBy("balance", "desc")
    .orderBy("s.full_name", "asc")
    .execute();
}
