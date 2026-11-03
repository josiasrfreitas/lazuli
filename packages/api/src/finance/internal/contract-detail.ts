import { deriveInstallmentLedger } from "@lazuli/domain";
import type { Prisma } from "@lazuli/db";
import { TRPCError } from "@trpc/server";
import {
  contractSelect,
  toRow,
  renegotiatedInstallmentAmount,
  type ContractListRow,
} from "./contracts-select.js";
import { toDateOnlyString, type FinanceDatabase } from "./shared.js";

const detailSelect = { ...contractSelect, punctualityDiscountPct: true } as const;
type DetailRow = Prisma.ContractGetPayload<{ select: typeof detailSelect }>;
type Order = DetailRow["orders"][number];
type Installment = Order["installments"][number];
type CalendarRow = {
  dueDate: string;
  tuitionCents: number;
  materialCents: number;
  otherCents: number;
  balanceCents: number;
  paidCents: number;
};
type Material = NonNullable<Order["material"]>;
type MaterialView = Pick<
  Material,
  | "scholarshipAgreement"
  | "name"
  | "items"
  | "stageId"
  | "stageCode"
  | "category"
  | "payment"
  | "listPriceCents"
  | "chargedAmountCents"
  | "cardFeeCents"
  | "quotedInstallments"
  | "quotedInstallmentCents"
> & { scholarshipPct: number; cashDiscountPct: number; cardFeePct: number | null };
type OrderView = {
  id: string;
  kind: Order["kind"];
  cancelled: boolean;
  totalCents: number;
  material: MaterialView | null;
  installments: {
    id: string;
    sequence: number;
    dueDate: string;
    amountCents: number;
    balanceCents: number;
    paidCents: number;
    status: ReturnType<typeof deriveInstallmentLedger>["status"];
  }[];
};
type ContractDetail = ContractListRow & {
  punctualityDiscountPct: number;
  terminated: boolean;
  orders: OrderView[];
  calendar: (CalendarRow & { id: string })[];
};

export async function readContract(
  database: FinanceDatabase,
  options: { id: string; now: Date },
): Promise<ContractDetail> {
  const { id, now } = options;
  const contract = await database.contract.findFirst({
    where: { id, deletedAt: null, commandId: { not: null } },
    select: detailSelect,
  });
  if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "Contrato não encontrado." });
  const calendar = new Map<string, CalendarRow>();
  const orders = contract.orders.map((order) => projectOrder({ order, now, calendar }));
  return {
    ...toRow(contract, now),
    punctualityDiscountPct: Number(contract.punctualityDiscountPct),
    terminated: Boolean(contract.terminatedAt),
    orders,
    calendar: [...calendar.values()]
      .toSorted((left, right) => left.dueDate.localeCompare(right.dueDate))
      .map((row) => ({ ...row, id: row.dueDate })),
  };
}

function projectOrder(input: {
  order: Order;
  now: Date;
  calendar: Map<string, CalendarRow>;
}): OrderView {
  const { order, now, calendar } = input;
  return {
    id: order.id,
    kind: order.kind,
    cancelled: Boolean(order.cancelledAt),
    totalCents:
      order.principalAmountCents +
      order.installments.reduce(
        (sum, row) => sum + renegotiatedInstallmentAmount(row) - row.amountCents,
        0,
      ),
    material: order.material ? projectMaterial(order.material) : null,
    installments: order.installments.map((entry) =>
      projectInstallment({ entry, order, now, calendar }),
    ),
  };
}

function projectMaterial(material: Material): MaterialView {
  return {
    name: material.name,
    scholarshipPct: Number(material.scholarshipPct),
    scholarshipAgreement: material.scholarshipAgreement,
    items: material.items,
    stageId: material.stageId,
    stageCode: material.stageCode,
    category: material.category,
    payment: material.payment,
    listPriceCents: material.listPriceCents,
    cashDiscountPct: Number(material.cashDiscountPct),
    chargedAmountCents: material.chargedAmountCents,
    cardFeePct: material.cardFeePct === null ? null : Number(material.cardFeePct),
    cardFeeCents: material.cardFeeCents,
    quotedInstallments: material.quotedInstallments,
    quotedInstallmentCents: material.quotedInstallmentCents,
  };
}

function projectInstallment(input: {
  entry: Installment;
  order: Order;
  now: Date;
  calendar: Map<string, CalendarRow>;
}): OrderView["installments"][number] {
  const { entry, order, now, calendar } = input;
  const ledger = deriveInstallmentLedger({
    ...entry,
    orderCancelledAt: order.cancelledAt,
    now,
  });
  const dueDate = toDateOnlyString(entry.dueDate);
  if (!order.cancelledAt)
    addToCalendar({
      calendar,
      dueDate,
      kind: order.kind,
      amountCents: renegotiatedInstallmentAmount(entry),
      ledger,
    });
  return {
    id: entry.id,
    sequence: entry.sequenceNumber,
    dueDate,
    amountCents: renegotiatedInstallmentAmount(entry),
    balanceCents: ledger.collectibleRemainingCents,
    paidCents: ledger.paidAmountCents,
    status: ledger.status,
  };
}

function addToCalendar(input: {
  calendar: Map<string, CalendarRow>;
  dueDate: string;
  kind: Order["kind"];
  amountCents: number;
  ledger: ReturnType<typeof deriveInstallmentLedger>;
}): void {
  const { calendar, dueDate, kind, amountCents, ledger } = input;
  const row = calendar.get(dueDate) ?? {
    dueDate,
    tuitionCents: 0,
    materialCents: 0,
    otherCents: 0,
    balanceCents: 0,
    paidCents: 0,
  };
  if (kind === "TUITION") row.tuitionCents += amountCents;
  else if (kind === "MATERIAL") row.materialCents += amountCents;
  else row.otherCents += amountCents;
  row.balanceCents += ledger.collectibleRemainingCents;
  row.paidCents += ledger.paidAmountCents;
  calendar.set(dueDate, row);
}
