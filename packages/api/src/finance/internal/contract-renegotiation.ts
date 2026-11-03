import { createHash } from "node:crypto";
import { contractReduction, saoPauloDateOnly } from "@lazuli/domain";
import type {
  ContractRenegotiationConfirm,
  ContractRenegotiationPreview,
} from "@lazuli/validators";
import { badRequest, notFound } from "../../trpc/errors.js";
import { lockInstallments } from "./payment-store.js";
import { loadSettlementItems, settlementLine, type SettlementItem } from "./settlement-data.js";
import { toDateOnly, toDateOnlyString, type FinanceDatabase } from "./shared.js";

const MAX_CENTS = 2_147_483_647;
const hash = (value: object): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
type ReductionLine = {
  id: string;
  sequence: number;
  dueDate: string;
  principalCents: number;
  openPrincipalCents: number;
  balanceCents: number;
  minimumCents: number;
  paidCents: number;
  chargesCents: number;
  newInterestCents: number;
  version: string;
};
type RenegotiationOptions = {
  contractId: string;
  studentId: string;
  studentName: string;
  today: string;
  lines: ReductionLine[];
  history: Array<{
    id: string;
    effectiveDate: string;
    newAmountCents: number;
    reductionCents: number;
    installmentCount: number;
    reason: string;
    actorName: string;
  }>;
};
type RenegotiationPreview = {
  contractId: string;
  studentId: string;
  studentName: string;
  today: string;
  newAmountCents: number;
  lines: Array<ReductionLine & { reductionCents: number; resultingBalanceCents: number }>;
  reductionCents: number;
  version: string;
};
type RenegotiationResult = { contractId: string; reductionCents: number; count: number };

export async function contractRenegotiationOptions(
  database: FinanceDatabase,
  { contractId, now }: { contractId: string; now: Date },
): Promise<RenegotiationOptions> {
  const contract = await database.contract.findUnique({
    where: { id: contractId },
    include: { student: { select: { fullName: true } } },
  });
  if (!contract || contract.deletedAt) throw notFound("Contrato não encontrado.");
  if (contract.terminatedAt) throw badRequest("Este contrato já foi rescindido.");
  const today = saoPauloDateOnly(now);
  const ids = await database.installment.findMany({
    where: {
      deletedAt: null,
      waivedAt: null,
      order: { contractId, kind: "TUITION", deletedAt: null, cancelledAt: null },
    },
    select: { id: true },
  });
  const items = await loadSettlementItems(
    database,
    ids.map((item) => item.id),
  );
  const lines = items
    .map((item) => reductionLine(item, { today, now }))
    .filter((line) => line.openPrincipalCents > 0)
    .toSorted(
      (left, right) => left.dueDate.localeCompare(right.dueDate) || left.id.localeCompare(right.id),
    );
  return {
    contractId,
    studentId: contract.studentId,
    studentName: contract.student.fullName,
    today,
    lines,
    history: await loadRenegotiationHistory(database, contractId),
  };
}

async function loadRenegotiationHistory(
  database: FinanceDatabase,
  contractId: string,
): Promise<RenegotiationOptions["history"]> {
  const history = await database.contractRenegotiation.findMany({
    where: { contractId, deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 20,
    select: {
      id: true,
      effectiveDate: true,
      newAmountCents: true,
      reductionCents: true,
      installmentCount: true,
      reason: true,
      actorName: true,
    },
  });
  return history.map((row) => ({ ...row, effectiveDate: toDateOnlyString(row.effectiveDate) }));
}

function reductionLine(
  item: SettlementItem,
  { today, now }: { today: string; now: Date },
): ReductionLine {
  const { quote, version } = settlementLine({ item, date: today, now });
  const principalCents =
    item.amountCents +
    item.adjustments
      .filter((row) => row.type !== "INTEREST" && row.type !== "LATE_FEE" && !row.chargeOnly)
      .reduce((sum, row) => sum + row.amountCents, 0);
  const balanceCents = quote.balanceCents + quote.newInterestCents;
  const openPrincipalCents = Math.max(0, balanceCents - quote.outstandingChargesCents);
  return {
    id: item.id,
    sequence: item.sequenceNumber,
    dueDate: toDateOnlyString(item.dueDate),
    principalCents,
    openPrincipalCents,
    balanceCents,
    minimumCents: Math.max(0, principalCents - openPrincipalCents),
    paidCents: item.allocations.reduce((sum, row) => sum + row.amountCents, 0),
    chargesCents: quote.outstandingChargesCents,
    newInterestCents: quote.newInterestCents,
    version,
  };
}

export async function previewContractRenegotiation(
  database: FinanceDatabase,
  { values, now }: { values: ContractRenegotiationPreview; now: Date },
): Promise<RenegotiationPreview> {
  const options = await contractRenegotiationOptions(database, {
    contractId: values.contractId,
    now,
  });
  const selected = options.lines.filter((line) => values.installmentIds.includes(line.id));
  if (selected.length !== values.installmentIds.length)
    throw badRequest("Selecione apenas parcelas com principal em aberto deste contrato.");
  let plan: ReturnType<typeof contractReduction<(typeof selected)[number]>>;
  try {
    plan = contractReduction(selected, values.newAmountCents);
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : "Confira as parcelas selecionadas.");
  }
  if (plan.reductionCents > MAX_CENTS) throw badRequest("A redução ultrapassa o limite permitido.");
  return {
    contractId: options.contractId,
    studentId: options.studentId,
    studentName: options.studentName,
    today: options.today,
    newAmountCents: values.newAmountCents,
    ...plan,
    version: hash({
      contractId: options.contractId,
      today: options.today,
      amount: values.newAmountCents,
      lines: plan.lines,
    }),
  };
}

export async function confirmContractRenegotiation(input: {
  database: FinanceDatabase;
  values: ContractRenegotiationConfirm;
  actor: { id: string; name: string };
  now: Date;
}): Promise<RenegotiationResult> {
  const { database, values, actor, now } = input;
  await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${values.commandId}, 0))`;
  const fingerprint = hash(values);
  const replay = await findRenegotiationReplay(database, {
    commandId: values.commandId,
    fingerprint,
  });
  if (replay) return replay;
  await database.$queryRaw`SELECT id FROM "Contract" WHERE id = ${values.contractId}::uuid FOR UPDATE`;
  await lockInstallments(database, values.installmentIds.toSorted());
  const preview = await previewContractRenegotiation(database, { values, now });
  if (preview.version !== values.version)
    throw badRequest("As parcelas mudaram. Atualize a prévia antes de confirmar.");
  const agreement = await database.contractRenegotiation.create({
    data: {
      commandId: values.commandId,
      fingerprint,
      contractId: values.contractId,
      actorId: actor.id,
      actorName: actor.name,
      effectiveDate: toDateOnly(preview.today),
      newAmountCents: values.newAmountCents,
      reductionCents: preview.reductionCents,
      installmentCount: preview.lines.length,
      reason: values.reason,
      snapshot: preview,
    },
  });
  await recordRenegotiationAdjustments(database, {
    preview,
    agreementId: agreement.id,
    actorId: actor.id,
    reason: values.reason,
  });
  return {
    contractId: values.contractId,
    reductionCents: preview.reductionCents,
    count: preview.lines.length,
  };
}

async function findRenegotiationReplay(
  database: FinanceDatabase,
  { commandId, fingerprint }: { commandId: string; fingerprint: string },
): Promise<RenegotiationResult | null> {
  const previous = await database.contractRenegotiation.findUnique({ where: { commandId } });
  if (!previous) return null;
  if (previous.fingerprint !== fingerprint)
    throw badRequest("Esta confirmação já foi usada para outra renegociação.");
  return {
    contractId: previous.contractId,
    reductionCents: previous.reductionCents,
    count: previous.installmentCount,
  };
}

async function recordRenegotiationAdjustments(
  database: FinanceDatabase,
  {
    preview,
    agreementId,
    actorId,
    reason,
  }: { preview: RenegotiationPreview; agreementId: string; actorId: string; reason: string },
): Promise<void> {
  for (const line of preview.lines) {
    // Book accrued interest before reducing principal; earlier receipts and interest remain intact.
    if (line.newInterestCents > 0)
      await database.installmentAdjustment.create({
        data: {
          installmentId: line.id,
          type: "INTEREST",
          amountCents: line.newInterestCents,
          effectiveDate: toDateOnly(preview.today),
          reason: "Juros apurados na renegociação contratual",
          createdById: actorId,
          updatedById: actorId,
        },
      });
    await database.installmentAdjustment.create({
      data: {
        renegotiationId: agreementId,
        installmentId: line.id,
        type: "CORRECTION",
        amountCents: -line.reductionCents,
        chargeOnly: false,
        effectiveDate: toDateOnly(preview.today),
        reason: `Renegociação contratual: ${reason}`,
        createdById: actorId,
        updatedById: actorId,
      },
    });
  }
}
