import type { FinanceDatabase, FinanceSeedInput } from "./seed-dev-finance.js";
import {
  createInstallments,
  createPayment,
  monthlyDueDate,
  studentId,
} from "./seed-dev-finance.js";
import { addDays, stableUuid } from "./seed-dev-support.js";

const DEV_FINANCE_KEY = "dev-finance";
const JOINT_ORDER_DUE_DAY = 10;
const JOINT_ORDER_INSTALLMENT_CENTS = 35_000;
const JOINT_ORDER_PARTIAL_PAYMENT_CENTS = 9000;

export async function createJointOrderForSharedPayerScenario(
  database: FinanceDatabase,
  input: FinanceSeedInput,
): Promise<void> {
  const payerId = stableUuid([DEV_FINANCE_KEY, "shared-payer"]);
  // Keep the historical key so existing local fixture identifiers remain stable.
  const scenarioKey = "homonym-joint-order";
  const orderId = stableUuid([DEV_FINANCE_KEY, `${scenarioKey}-order`]);
  const dueDate = monthlyDueDate(input.todayIso, {
    monthOffset: 0,
    dueDay: JOINT_ORDER_DUE_DAY,
  });
  await database.order.create({
    data: {
      id: orderId,
      payerId,
      kind: "TUITION",
      principalAmountCents: JOINT_ORDER_INSTALLMENT_CENTS,
      startDate: monthlyDueDate(input.todayIso, { monthOffset: -1, dueDay: JOINT_ORDER_DUE_DAY }),
      dueDay: JOINT_ORDER_DUE_DAY,
    },
  });
  await database.orderBeneficiary.createMany({
    data: ["ana", "joao"].map((studentKey) => ({
      id: stableUuid([DEV_FINANCE_KEY, scenarioKey, studentKey]),
      orderId,
      studentId: studentId(input.studentIds, studentKey),
    })),
  });
  const [installmentId] = await createInstallments(database, {
    scenarioKey,
    orderId,
    amountCents: JOINT_ORDER_INSTALLMENT_CENTS,
    dueDates: [dueDate],
  });
  if (installmentId === undefined)
    throw new Error("Dev seed misconfiguration: missing installment.");
  await createPayment(database, {
    scenarioKey: `${scenarioKey}-partial`,
    payerId,
    installmentId,
    amountCents: JOINT_ORDER_PARTIAL_PAYMENT_CENTS,
    date: addDays(dueDate, 1),
  });
}
