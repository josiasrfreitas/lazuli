import { performance } from "node:perf_hooks";

export type ReadSpan = {
  delegate: string;
  startedMs: number;
  endedMs: number;
  cpuMs: number;
  rows: number;
};
export type ReadRequest = { reads: ReadSpan[]; cardinality: Record<string, number> };
type Database = typeof import("../../packages/db/src/index.js").db;

/** Wrap actual Prisma reads, including client hydration; never retain records or query arguments. */
export function instrumentReceivablesReads(
  database: Database,
  request: () => ReadRequest | undefined,
) {
  const delegates = new Set(["installment", "installmentAdjustment", "paymentAllocation"]);
  return new Proxy(database, {
    get(target, property, receiver) {
      const delegate = Reflect.get(target, property, receiver);
      if (typeof property !== "string" || !delegates.has(property)) return delegate;
      return new Proxy(delegate, {
        get(model, operation) {
          const method = Reflect.get(model, operation);
          if (operation !== "findMany") return method;
          return async (...args: unknown[]) => {
            const current = request();
            if (!current) return Reflect.apply(method, model, args);
            const startedMs = performance.now();
            const beforeCpu = process.cpuUsage();
            const rows = (await Reflect.apply(method, model, args)) as unknown[];
            const endedMs = performance.now();
            const cpu = process.cpuUsage(beforeCpu);
            current.reads.push({
              delegate: property,
              startedMs,
              endedMs,
              cpuMs: (cpu.user + cpu.system) / 1000,
              rows: rows.length,
            });
            if (property === "installment") {
              const orders = new Set<string>();
              let beneficiaries = 0;
              let contractStudents = 0;
              let payerObjects = 0;
              for (const row of rows as Array<{
                orderId?: string;
                order?: { payer: unknown; contract: unknown; beneficiaries: unknown[] };
              }>) {
                if (row.orderId !== undefined) orders.add(row.orderId);
                if (row.order === undefined) continue;
                beneficiaries += row.order.beneficiaries.length;
                contractStudents += Number(row.order.contract !== null);
                payerObjects +=
                  Number(row.order.payer !== null) + Number(row.order.contract !== null);
              }
              Object.assign(current.cardinality, {
                installments: rows.length,
                // A minimal projection omits order ids: absence is unknown, not zero orders.
                ...(orders.size > 0 ? { distinctOrders: orders.size } : {}),
                beneficiaryOccurrences: beneficiaries,
                contractStudentOccurrences: contractStudents,
                payerObjectOccurrences: payerObjects,
              });
            } else {
              const key = property === "installmentAdjustment" ? "adjustments" : "allocationRows";
              current.cardinality[key] = (current.cardinality[key] ?? 0) + rows.length;
            }
            return rows;
          };
        },
      });
    },
  });
}
