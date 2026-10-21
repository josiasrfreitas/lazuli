import { materialPriceVersion } from "./material-price-version.js";
import { createHash } from "node:crypto";
import { addCalendarMonths, materialPriceQuote } from "@lazuli/domain";
import type { FinanceSettings, Prisma } from "@lazuli/db";
import type { AddContractMaterialInput, ContractMaterialInput } from "@lazuli/validators";
import { TRPCError } from "@trpc/server";
import { lockCreationCommand } from "../../creation-command.js";
import { toDateOnly, toDateOnlyString, type FinanceDatabase } from "./shared.js";

// Explicit scope until the SGF catalog supplies a durable language attribute.
const ENGLISH_TRACKS = [
  "Adultos / English Main",
  "Adultos / Speed",
  "Infantil",
  "Teens Connect",
  "Teens Legacy",
  "Teenstation Legacy",
];

export async function materialOrderData(input: {
  database: FinanceDatabase;
  material: ContractMaterialInput;
  settings: FinanceSettings;
  firstDueDate: string;
  scheduleAnchor?: { date: string; offset: number };
  staffUserId: string;
}): Promise<Prisma.OrderCreateWithoutContractInput> {
  const { database, material, settings, firstDueDate, staffUserId } = input;
  const stageIds = material.stageIds;
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
  const orderedStages = stageIds.map((id) => stages.find((stage) => stage.id === id)!);
  const stage = orderedStages[0]!;
  const child = material.category === "CHILD";
  const cardFeePct = Number(settings.materialCardFeePct);
  const perBookInstallments = child
    ? settings.childMaterialInstallments
    : settings.adultMaterialInstallments;
  const quote = materialPriceQuote({
    installments: perBookInstallments * stageIds.length,
    installmentCents: child
      ? settings.childMaterialInstallmentCents
      : settings.adultMaterialInstallmentCents,
    cardFeePct,
  });
  const cash = material.payment === "CASH";
  const total = cash ? quote.cashCents : quote.totalCents;
  if (
    total !== material.expectedTotalCents ||
    material.quoteVersion !==
      materialPriceVersion(perBookInstallments, quote.installmentCents, cardFeePct)
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
  const receivableCents = quote.cashCents;
  return {
    kind: "MATERIAL",
    principalAmountCents: receivableCents,
    startDate: toDateOnly(firstDueDate),
    firstDueDate: toDateOnly(firstDueDate),
    dueDay: Number((input.scheduleAnchor?.date ?? firstDueDate).slice(8, 10)),
    installmentCount: 1,
    createdBy: { connect: { id: staffUserId } },
    updatedBy: { connect: { id: staffUserId } },
    material: {
      create: {
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
        listPriceCents: quote.totalCents,
        cashDiscountPct: 0,
        chargedAmountCents: total,
        cardFeePct: cash ? 0 : cardFeePct,
        cardFeeCents: cash ? 0 : quote.totalCents - receivableCents,
        quotedInstallments: quote.installments,
        quotedInstallmentCents: quote.installmentCents,
      },
    },
    installments: {
      create: {
        sequenceNumber: 1,
        amountCents: receivableCents,
        dueDate: toDateOnly(firstDueDate),
        createdById: staffUserId,
        updatedById: staffUserId,
      },
    },
  };
}

/** Explicit acquisition only; renewal never copies material orders. */
export async function addContractMaterial(input: {
  database: FinanceDatabase;
  staffUserId: string;
  values: AddContractMaterialInput;
}) {
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
  await database.$queryRaw`SELECT id FROM "Contract" WHERE id = ${values.contractId}::uuid FOR UPDATE`;
  const contract = await database.contract.findFirst({
    where: { id: values.contractId, deletedAt: null, terminatedAt: null },
    include: {
      orders: { where: { kind: "TUITION", deletedAt: null, cancelledAt: null }, take: 1 },
    },
  });
  const first = contract?.orders[0]?.firstDueDate;
  if (!contract || !first)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Contrato indisponível para adquirir material.",
    });
  const anchor = toDateOnlyString(first);
  const monthDistance =
    (Number(values.firstDueDate.slice(0, 4)) - Number(anchor.slice(0, 4))) * 12 +
    Number(values.firstDueDate.slice(5, 7)) -
    Number(anchor.slice(5, 7));
  if (monthDistance < 0 || addCalendarMonths(anchor, monthDistance) !== values.firstDueDate)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "O material deve seguir o dia de vencimento do contrato.",
    });
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
    data: { ...data, contract: { connect: { id: contract.id } } },
  });
  await database.materialOrder.update({
    where: { orderId: order.id },
    data: { commandId: values.commandId, commandFingerprint: fingerprint },
  });
  return { orderId: order.id, contractId: contract.id };
}

export async function contractMaterialOptions(database: FinanceDatabase) {
  return database.stage.findMany({
    where: {
      deletedAt: null,
      track: {
        deletedAt: null,
        name: { in: ENGLISH_TRACKS },
        productLine: { deletedAt: null, status: "ACTIVE" },
      },
    },
    select: {
      id: true,
      name: true,
      internalCode: true,
      track: { select: { name: true, ageGroup: true, productLine: { select: { name: true } } } },
    },
    orderBy: [{ track: { name: "asc" } }, { sequence: "asc" }],
  });
}
