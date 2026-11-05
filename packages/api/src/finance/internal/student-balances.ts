import { saoPauloDateOnly } from "@lazuli/domain";
import { sql, type QueryCreator, type SelectQueryBuilder } from "kysely";
import type { KyselyDatabase } from "@lazuli/db";
import type { FinanceDatabase } from "./shared.js";

/** No active order differs from an active order whose collectible debt is zero. */
export type StudentOverdueTotal = {
  studentId: string;
  hasActiveOrder: boolean;
  overdueCents: number;
};

export async function studentOverdueTotals(input: {
  database: FinanceDatabase;
  values: { studentIds: readonly string[]; now: Date };
}): Promise<StudentOverdueTotal[]> {
  const ids = [...input.values.studentIds];
  if (ids.length === 0) return [];
  const businessDate = saoPauloDateOnly(input.values.now);
  const rows = await input.database.$kysely
    .with("student_orders", () => studentOrders(input.database, ids))
    .with("order_ids", (db) => db.selectFrom("student_orders").select("orderId").distinct())
    .with("installment_balances", (db) => installmentBalances(db, new Date(businessDate)))
    .with("order_balances", (db) =>
      db
        .selectFrom("installment_balances")
        .select("orderId")
        .select(
          sql<number>`sum(greatest("amountCents" + adjustments - paid, 0))::double precision`.as(
            "overdueCents",
          ),
        )
        .groupBy("orderId"),
    )
    .selectFrom("student_orders as s")
    .leftJoin("order_balances as b", "b.orderId", "s.orderId")
    .select("s.studentId")
    .select(sql<number>`coalesce(sum(b."overdueCents"), 0)::double precision`.as("overdueCents"))
    .groupBy("s.studentId")
    .execute();
  const totals = new Map(rows.map((row) => [row.studentId, row.overdueCents]));
  return ids.map((studentId) => ({
    studentId,
    hasActiveOrder: totals.has(studentId),
    overdueCents: totals.get(studentId) ?? 0,
  }));
}

type PartyScope = KyselyDatabase & {
  o: KyselyDatabase["Order"];
  c: KyselyDatabase["Contract"];
  s: KyselyDatabase["Student"];
};
function studentOrders(
  database: FinanceDatabase,
  ids: string[],
): SelectQueryBuilder<PartyScope, "o" | "c" | "s", { studentId: string; orderId: string }> {
  const activeOrders = database.$kysely
    .selectFrom("Order as o")
    .where("o.deleted_at", "is", null)
    .where("o.cancelled_at", "is", null);
  return activeOrders
    .innerJoin("Contract as c", "c.id", "o.contract_id")
    .innerJoin("Student as s", "s.id", "c.student_id")
    .where("c.deleted_at", "is", null)
    .where("s.deleted_at", "is", null)
    .where("s.id", "in", ids)
    .select(["s.id as studentId", "o.id as orderId"])
    .unionAll(
      activeOrders
        .innerJoin("OrderBeneficiary as b", "b.order_id", "o.id")
        .innerJoin("Student as s", "s.id", "b.student_id")
        .where("o.contract_id", "is", null)
        .where("b.deleted_at", "is", null)
        .where("s.deleted_at", "is", null)
        .where("s.id", "in", ids)
        .select(["s.id as studentId", "o.id as orderId"]),
    );
}

type OrderScope = KyselyDatabase & {
  student_orders: { studentId: string; orderId: string };
  order_ids: { orderId: string };
};

function installmentBalances(
  db: QueryCreator<OrderScope>,
  businessDate: Date,
): SelectQueryBuilder<
  OrderScope & { i: KyselyDatabase["Installment"] },
  "i" | "order_ids",
  { orderId: string; amountCents: number; adjustments: number | null; paid: number | null }
> {
  return db
    .selectFrom("Installment as i")
    .innerJoin("order_ids", "order_ids.orderId", "i.order_id")
    .where("i.deleted_at", "is", null)
    .where("i.waived_at", "is", null)
    .where("i.due_date", "<", businessDate)
    .select((eb) => [
      "i.order_id as orderId",
      "i.amount_cents as amountCents",
      eb
        .selectFrom("InstallmentAdjustment as a")
        .whereRef("a.installment_id", "=", "i.id")
        .where("a.deleted_at", "is", null)
        .select((amount) =>
          amount.fn.coalesce(amount.fn.sum<number>("a.amount_cents"), amount.val(0)).as("amount"),
        )
        .as("adjustments"),
      eb
        .selectFrom("PaymentAllocation as a")
        .innerJoin("PaymentEntry as p", "p.id", "a.payment_entry_id")
        .whereRef("a.installment_id", "=", "i.id")
        .where("a.deleted_at", "is", null)
        .where("p.deleted_at", "is", null)
        .select((amount) =>
          amount.fn
            .coalesce(
              amount.fn.sum<number>(sql<number>`a.amount_cents - coalesce((
              select sum(reversal_line.amount_cents)
              from payment_reversal_allocations reversal_line
              join payment_reversals reversal on reversal.id = reversal_line.payment_reversal_id
              where reversal_line.payment_allocation_id = a.id
                and reversal_line.deleted_at is null and reversal.deleted_at is null
            ), 0)`),
              amount.val(0),
            )
            .as("amount"),
        )
        .as("paid"),
    ]);
}
