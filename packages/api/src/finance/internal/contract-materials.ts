import { materialFinalPriceVersion, materialPriceVersion } from "./material-price-version.js";
import { createHash } from "node:crypto";
import {
  addCalendarMonths,
  materialFinalPriceQuote,
  materialFinalSaleQuote,
  materialPriceQuote,
  materialInstallmentPlan,
} from "@lazuli/domain";
import type { FinanceSettings, Prisma } from "@lazuli/db";
import type { AddContractMaterialInput, ContractMaterialInput } from "@lazuli/validators";
import { TRPCError } from "@trpc/server";
import { lockCreationCommand } from "../../creation-command.js";
import { toDateOnly, toDateOnlyString, type FinanceDatabase } from "./shared.js";
import { readMaterialCardFeeRates } from "./settings.js";

const ISO_DAY_START_INDEX = 8;
const ISO_DATE_LENGTH = 10;
const ISO_YEAR_END_INDEX = 4;
const MONTHS_PER_YEAR = 12;
const ISO_MONTH_START_INDEX = 5;
const ISO_MONTH_END_INDEX = 7;
const FULL_SCHOLARSHIP_PCT = 100;

// Explicit scope until the SGF catalog supplies a durable language attribute.
const ENGLISH_TRACKS = [
  "Adultos / English Main",
  "Adultos / Speed",
  "Infantil",
  "Teens Connect",
  "Teens Legacy",
  "Teenstation Legacy",
];
type MaterialStage = { id: string; name: string; internalCode: string };
type MaterialPrice = {
  quote: ReturnType<typeof materialFinalPriceQuote>;
  cash: boolean;
  cardFeePct: number;
};

export async function materialOrderData(input: {
  database: FinanceDatabase;
  material: ContractMaterialInput;
  settings: FinanceSettings;
  firstDueDate: string;
  scheduleAnchor?: { date: string; offset: number };
  staffUserId: string;
}): Promise<Prisma.OrderCreateWithoutContractInput> {
  const { database, material, settings, firstDueDate, staffUserId } = input;
  const orderedStages = await materialStages(database, material.stageIds);
  const { quote, cash, cardFeePct } = quotedMaterial(material, settings);
  const scholarship = scholarshipQuote(quote, { material, cardFeePct });
  const receivableCents = scholarship.receivableCents;
  return {
    kind: "MATERIAL",
    principalAmountCents: receivableCents,
    startDate: toDateOnly(firstDueDate),
    firstDueDate: toDateOnly(firstDueDate),
    dueDay: Number(
      (input.scheduleAnchor?.date ?? firstDueDate).slice(ISO_DAY_START_INDEX, ISO_DATE_LENGTH),
    ),
    installmentCount: receivableCents > 0 ? 1 : 0,
    createdBy: { connect: { id: staffUserId } },
    updatedBy: { connect: { id: staffUserId } },
    material: {
      create: materialCreateData({ orderedStages, material, quote, cash, cardFeePct }),
    },
    installments: {
      create:
        receivableCents > 0
          ? [
              {
                sequenceNumber: 1,
                amountCents: receivableCents,
                dueDate: toDateOnly(firstDueDate),
                createdById: staffUserId,
                updatedById: staffUserId,
              },
            ]
          : [],
    },
  };
}

function scholarshipQuote(
  quote: ReturnType<typeof materialFinalPriceQuote>,
  { material, cardFeePct }: { material: ContractMaterialInput; cardFeePct: number },
): ReturnType<typeof materialFinalSaleQuote> {
  try {
    return materialFinalSaleQuote({
      quote,
      payment: material.payment,
      scholarshipPct: material.scholarshipPct ?? 0,
      cardFeePct,
      priceOverrideCents: material.priceOverrideCents,
    });
  } catch (error) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: error instanceof Error ? error.message : "Confira os valores da bolsa de material.",
      cause: error,
    });
  }
}

async function materialStages(
  database: FinanceDatabase,
  stageIds: string[],
): Promise<MaterialStage[]> {
  if (new Set(stageIds).size !== stageIds.length)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Selecione livros de estágios diferentes.",
    });
  const stages = await database.stage.findMany({
    where: {
      id: { in: stageIds },
      deletedAt: null,
      track: {
        deletedAt: null,
        name: { in: ENGLISH_TRACKS },
        productLine: { deletedAt: null, status: "ACTIVE" },
      },
    },
    select: { id: true, name: true, internalCode: true },
  });
  if (stages.length !== stageIds.length)
    throw new TRPCError({ code: "NOT_FOUND", message: "Estágio indisponível." });
  return stageIds.map((id) => stages.find((stage) => stage.id === id)!);
}

function quotedMaterial(material: ContractMaterialInput, settings: FinanceSettings): MaterialPrice {
  const child = material.category === "CHILD";
  const rates = readMaterialCardFeeRates(
    settings.materialCardFeeRates,
    Number(settings.materialCardFeePct),
  );
  const cardFeePct = materialCardFeeRate(material, rates);
  const terms = materialPricingTerms(settings, child);
  const quote = materialFinalPriceQuote({
    cashCents: terms.cashCents * material.stageIds.length,
    cardFeePct,
  });
  const cash = material.payment === "CASH";
  const total = cash ? quote.cashCents : quote.totalCents;
  if (
    total !== material.expectedTotalCents ||
    material.quoteVersion !== materialQuoteVersion({ terms, settings, rates })
  )
    throw new TRPCError({
      code: "CONFLICT",
      message: "O preço do material mudou. Confira o valor atualizado antes de confirmar.",
    });
  if (quote.cashCents === 0)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "O material está sem valor de cobrança. Revise o preço em Ajustes.",
    });
  return { quote, cash, cardFeePct };
}

function materialCardFeeRate(
  material: ContractMaterialInput,
  rates: Record<string, number>,
): number {
  const rate =
    material.payment === "CASH" || material.scholarshipPct === FULL_SCHOLARSHIP_PCT
      ? 0
      : rates[String(material.installmentCount)];
  if (rate === undefined)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Configure a taxa para esta quantidade de parcelas em Ajustes.",
    });
  return rate;
}

function materialPricingTerms(
  settings: FinanceSettings,
  child: boolean,
): {
  cashCents: number;
  legacyInstallments: number;
  legacyInstallmentCents: number;
  hasCashPrice: boolean;
} {
  const storedCashCents = child
    ? settings.childMaterialCashPriceCents
    : settings.adultMaterialCashPriceCents;
  const legacyInstallments = child
    ? settings.childMaterialInstallments
    : settings.adultMaterialInstallments;
  const legacyInstallmentCents = child
    ? settings.childMaterialInstallmentCents
    : settings.adultMaterialInstallmentCents;
  return {
    cashCents:
      storedCashCents ??
      materialPriceQuote({
        installments: legacyInstallments,
        installmentCents: legacyInstallmentCents,
        cardFeePct: Number(settings.materialCardFeePct),
      }).cashCents,
    legacyInstallments,
    legacyInstallmentCents,
    hasCashPrice: storedCashCents !== null,
  };
}

function materialQuoteVersion({
  terms,
  settings,
  rates,
}: {
  terms: ReturnType<typeof materialPricingTerms>;
  settings: FinanceSettings;
  rates: Record<string, number>;
}): string {
  return !terms.hasCashPrice && settings.materialCardFeeRates === null
    ? materialPriceVersion(terms.legacyInstallments, {
        installmentCents: terms.legacyInstallmentCents,
        cardFeePct: Number(settings.materialCardFeePct),
      })
    : materialFinalPriceVersion(terms.cashCents, rates);
}

function materialCreateData(input: {
  orderedStages: MaterialStage[];
  material: ContractMaterialInput;
  quote: ReturnType<typeof materialFinalPriceQuote>;
  cash: boolean;
  cardFeePct: number;
}): Prisma.MaterialOrderCreateWithoutOrderInput {
  const { orderedStages, material, quote, cash, cardFeePct } = input;
  const stage = orderedStages[0]!;
  const scholarship = scholarshipQuote(quote, { material, cardFeePct });
  let installments;
  try {
    installments = materialInstallmentPlan(scholarship.chargedCents, material.installmentCount);
  } catch (error) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: error instanceof Error ? error.message : "Confira o parcelamento do material.",
      cause: error,
    });
  }
  return {
    stage: { connect: { id: stage.id } },
    name: orderedStages.map((item) => item.name).join(" + "),
    items: {
      create: orderedStages.map((item, index) => ({
        position: index + 1,
        stage: { connect: { id: item.id } },
        name: item.name,
        stageCode: item.internalCode,
      })),
    },
    stageCode: stage.internalCode,
    category: material.category,
    payment: material.payment,
    listPriceCents: quote.cashCents,
    priceOverrideCents: material.priceOverrideCents ?? null,
    cashDiscountPct: 0,
    chargedAmountCents: scholarship.chargedCents,
    scholarshipPct: material.scholarshipPct ?? 0,
    scholarshipAgreement: material.scholarshipAgreement?.trim() || null,
    cardFeePct: cash ? 0 : cardFeePct,
    cardFeeCents: scholarship.feeCents,
    quotedInstallments: installments.installmentCount,
    quotedInstallmentCents: installments.installmentCents,
  };
}

/** Explicit acquisition only; renewal never copies material orders. */
export async function addContractMaterial(input: {
  database: FinanceDatabase;
  staffUserId: string;
  values: AddContractMaterialInput;
}): Promise<{ orderId: string; contractId: string }> {
  const { database, values, staffUserId } = input;
  await lockCreationCommand(database, values.commandId);
  const fingerprint = createHash("sha256").update(JSON.stringify(values)).digest("hex");
  const existing = await database.materialOrder.findUnique({
    where: { commandId: values.commandId },
    include: { order: true },
  });
  if (existing) {
    if (existing.commandFingerprint !== fingerprint)
      throw new TRPCError({
        code: "CONFLICT",
        message: "Identidade de aquisição usada com dados diferentes.",
      });
    return { orderId: existing.orderId, contractId: existing.order.contractId! };
  }
  const { contractId, anchor, monthDistance } = await materialContract(database, values);
  const settings = await database.financeSettings.findUnique({ where: { id: "singleton" } });
  if (!settings)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Configure os preços dos materiais em Ajustes.",
    });
  const data = await materialOrderData({
    database,
    settings,
    material: values.material,
    firstDueDate: values.firstDueDate,
    scheduleAnchor: { date: anchor, offset: monthDistance },
    staffUserId,
  });
  const order = await database.order.create({
    data: { ...data, contract: { connect: { id: contractId } } },
  });
  await database.materialOrder.update({
    where: { orderId: order.id },
    data: { commandId: values.commandId, commandFingerprint: fingerprint },
  });
  return { orderId: order.id, contractId };
}

async function materialContract(
  database: FinanceDatabase,
  values: AddContractMaterialInput,
): Promise<{ contractId: string; anchor: string; monthDistance: number }> {
  await database.$queryRaw`SELECT id FROM "Contract" WHERE id = ${values.contractId}::uuid FOR UPDATE`;
  const contract = await database.contract.findFirst({
    where: { id: values.contractId, deletedAt: null, terminatedAt: null },
    include: {
      orders: { where: { kind: "TUITION", deletedAt: null, cancelledAt: null }, take: 1 },
    },
  });
  const first =
    contract?.orders[0]?.firstDueDate ??
    (Number(contract?.scholarshipPct) === FULL_SCHOLARSHIP_PCT ? contract?.startsOn : null);
  if (!contract || !first)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Contrato indisponível para adquirir material.",
    });
  const anchor = toDateOnlyString(first);
  const monthDistance =
    (Number(values.firstDueDate.slice(0, ISO_YEAR_END_INDEX)) -
      Number(anchor.slice(0, ISO_YEAR_END_INDEX))) *
      MONTHS_PER_YEAR +
    Number(values.firstDueDate.slice(ISO_MONTH_START_INDEX, ISO_MONTH_END_INDEX)) -
    Number(anchor.slice(ISO_MONTH_START_INDEX, ISO_MONTH_END_INDEX));
  assertMaterialDueDate({ anchor, monthDistance, firstDueDate: values.firstDueDate });
  return { contractId: contract.id, anchor, monthDistance };
}

function assertMaterialDueDate({
  anchor,
  monthDistance,
  firstDueDate,
}: {
  anchor: string;
  monthDistance: number;
  firstDueDate: string;
}): void {
  if (monthDistance < 0 || addCalendarMonths(anchor, monthDistance) !== firstDueDate)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "O material deve seguir o dia de vencimento do contrato.",
    });
}

const materialOptionsSelect = {
  id: true,
  name: true,
  internalCode: true,
  sequence: true,
  trackId: true,
  track: { select: { name: true, ageGroup: true, productLine: { select: { name: true } } } },
} satisfies Prisma.StageSelect;

export async function contractMaterialOptions(
  database: FinanceDatabase,
): Promise<Prisma.StageGetPayload<{ select: typeof materialOptionsSelect }>[]> {
  return database.stage.findMany({
    where: {
      deletedAt: null,
      track: {
        deletedAt: null,
        name: { in: ENGLISH_TRACKS },
        productLine: { deletedAt: null, status: "ACTIVE" },
      },
    },
    select: materialOptionsSelect,
    orderBy: [{ track: { name: "asc" } }, { sequence: "asc" }],
  });
}
