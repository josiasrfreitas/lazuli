import { createHash } from "node:crypto";
import { saoPauloDateOnly, terminationFeeCents } from "@lazuli/domain";
import { DEFAULT_TERMINATION_FEE_PCT, type ContractTerminationConfirm } from "@lazuli/validators";
import { closeEnrollment } from "../../enrollment/close.js";
import { lockStudentEnrollment } from "../../enrollment/data.js";
import { badRequest, notFound } from "../../trpc/errors.js";
import { loadSettlementItems, settlementLine } from "./settlement-data.js";
import { lockInstallments } from "./payment-store.js";
import { toDateOnly, toDateOnlyString, type FinanceDatabase } from "./shared.js";

const hash = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export async function previewContractTermination(
  database: FinanceDatabase,
  contractId: string,
  now: Date,
) {
  const today = saoPauloDateOnly(now);
  const contract = await database.contract.findUnique({
    where: { id: contractId },
    include: { student: { select: { id: true, fullName: true } } },
  });
  if (!contract || contract.deletedAt) throw notFound("Contrato não encontrado.");
  if (contract.terminatedAt) throw badRequest("Este contrato já foi rescindido.");
  const [installments, enrollments] = await Promise.all([
    database.installment.findMany({
      where: {
        deletedAt: null,
        order: { contractId, kind: "TUITION", deletedAt: null, cancelledAt: null },
      },
      select: { id: true },
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    }),
    database.enrollment.findMany({
      where: {
        studentId: contract.studentId,
        deletedAt: null,
        entryDate: { lte: toDateOnly(today) },
        OR: [{ exitDate: null }, { exitDate: { gt: toDateOnly(today) } }],
      },
      select: {
        id: true,
        entryDate: true,
        exitDate: true,
        class: { select: { portalClassName: true } },
        actions: {
          where: { status: "SCHEDULED" },
          select: {
            id: true,
            kind: true,
            effectiveDate: true,
            semesterExits: { where: { publishedAt: { not: null } }, select: { id: true } },
          },
          orderBy: { id: "asc" },
        },
      },
      orderBy: { id: "asc" },
    }),
  ]);
  const items = (
    await loadSettlementItems(
      database,
      installments.map((row) => row.id),
    )
  ).sort((a, b) => a.id.localeCompare(b.id));
  const lines = items
    .filter((item) => !item.waivedAt)
    .map((item) => {
      const { quote, version } = settlementLine({ item, date: today, now });
      const chargesCents = quote.outstandingChargesCents;
      const principalCents = Math.max(
        0,
        quote.balanceCents + quote.newInterestCents - chargesCents,
      );
      return {
        id: item.id,
        sequence: item.sequenceNumber,
        dueDate: toDateOnlyString(item.dueDate),
        principalCents,
        chargesCents,
        version,
        paidCents: item.allocations.reduce((sum, allocation) => sum + allocation.amountCents, 0),
      };
    })
    .filter((line) => line.principalCents > 0 || line.chargesCents > 0);
  const openPrincipalCents = lines.reduce((sum, line) => sum + line.principalCents, 0);
  const overduePrincipalCents = lines
    .filter((line) => line.dueDate <= today)
    .reduce((sum, line) => sum + line.principalCents, 0);
  const chargesCents = lines.reduce((sum, line) => sum + line.chargesCents, 0);
  return {
    contractId,
    studentId: contract.studentId,
    studentName: contract.student.fullName,
    today,
    openPrincipalCents,
    overduePrincipalCents,
    waivedFuturePrincipalCents: openPrincipalCents - overduePrincipalCents,
    chargesCents,
    defaultFeePct: DEFAULT_TERMINATION_FEE_PCT,
    defaultFeeCents: terminationFeeCents(openPrincipalCents, DEFAULT_TERMINATION_FEE_PCT),
    lines,
    enrollments: enrollments.map((row) => ({
      id: row.id,
      className: row.class.portalClassName,
      scheduledChanges: row.actions.length > 0 || row.exitDate !== null,
      scheduledExitDate: row.actions.find(
        (action) => action.kind === "EXIT" || action.kind === "PAUSE",
      )?.effectiveDate
        ? toDateOnlyString(
            row.actions.find((action) => action.kind === "EXIT" || action.kind === "PAUSE")!
              .effectiveDate,
          )
        : row.exitDate
          ? toDateOnlyString(row.exitDate)
          : null,
      semesterPublished: row.actions.some((action) => action.semesterExits.length > 0),
    })),
    version: hash({ contract, today, lines, enrollments, items }),
  };
}

export async function confirmContractTermination(input: {
  database: FinanceDatabase;
  values: ContractTerminationConfirm;
  staffUserId: string;
  now: Date;
}) {
  const { database, values, staffUserId, now } = input;
  await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${values.commandId}, 0))`;
  await database.$queryRaw`SELECT id FROM "Contract" WHERE id = ${values.contractId}::uuid FOR UPDATE`;
  const contract = await database.contract.findUnique({ where: { id: values.contractId } });
  if (!contract || contract.deletedAt) throw notFound("Contrato não encontrado.");
  const fingerprint = hash(values);
  if (contract.terminatedAt) {
    if (
      contract.terminationCommandId === values.commandId &&
      contract.terminationFingerprint === fingerprint
    )
      return { contractId: contract.id, studentId: contract.studentId };
    throw badRequest("Este contrato já foi rescindido.");
  }
  await lockStudentEnrollment(database, contract.studentId);
  const ids = await database.installment.findMany({
    where: { order: { contractId: contract.id, kind: "TUITION" }, deletedAt: null },
    select: { id: true },
  });
  await lockInstallments(database, ids.map((row) => row.id).sort());
  const preview = await previewContractTermination(database, values.contractId, now);
  if (preview.version !== values.version)
    throw badRequest(
      "O contrato, as parcelas ou a matrícula mudaram. Atualize a prévia antes de confirmar.",
    );
  if (values.dueDate < preview.today)
    throw badRequest("O vencimento do acerto deve ser hoje ou uma data futura.");
  if (values.retainedChargesCents > preview.chargesCents)
    throw badRequest("Os encargos negociados não podem ultrapassar os encargos apurados.");
  if (
    new Set(values.enrollmentIds).size !== values.enrollmentIds.length ||
    values.enrollmentIds.some((id) => !preview.enrollments.some((row) => row.id === id))
  )
    throw badRequest("Selecione apenas matrículas ativas deste aluno.");
  if (preview.enrollments.length && !values.enrollmentIds.length)
    throw badRequest("Selecione a matrícula que será encerrada com o contrato.");
  if (
    preview.enrollments.some((row) => values.enrollmentIds.includes(row.id) && row.scheduledChanges)
  )
    throw badRequest(
      "A matrícula tem alterações programadas. Resolva essas programações antes da rescisão.",
    );
  const feeCents = terminationFeeCents(preview.openPrincipalCents, values.feePct);
  const totalCents = preview.overduePrincipalCents + values.retainedChargesCents + feeCents;
  if (!Number.isSafeInteger(totalCents) || totalCents > 2147483647)
    throw badRequest("O valor do acerto ultrapassa o limite permitido.");
  let settlementOrderId: string | null = null;
  if (totalCents > 0) {
    const order = await database.order.create({
      data: {
        payerId: contract.payerId,
        kind: "OTHER",
        principalAmountCents: totalCents,
        startDate: toDateOnly(preview.today),
        dueDay: Number(values.dueDate.slice(-2)),
        firstDueDate: toDateOnly(values.dueDate),
        installmentCount: 1,
        createdById: staffUserId,
        updatedById: staffUserId,
        beneficiaries: {
          create: {
            studentId: contract.studentId,
            createdById: staffUserId,
            updatedById: staffUserId,
          },
        },
        installments: {
          create: {
            sequenceNumber: 1,
            amountCents: totalCents,
            dueDate: toDateOnly(values.dueDate),
            createdById: staffUserId,
            updatedById: staffUserId,
          },
        },
      },
    });
    settlementOrderId = order.id;
  }
  // Preserve prior receipts and original amounts. Open balances are replaced by the reviewed settlement.
  await database.installment.updateMany({
    where: { id: { in: preview.lines.map((line) => line.id) } },
    data: {
      waivedAt: now,
      waivedReason: `Rescisão contratual: ${values.reason}`,
      updatedById: staffUserId,
    },
  });
  for (const enrollmentId of values.enrollmentIds)
    await closeEnrollment({ database, enrollmentId, reason: "DROPPED", staffUserId, now });
  await database.contract.update({
    where: { id: contract.id },
    data: {
      terminatedAt: now,
      terminationCommandId: values.commandId,
      terminationFingerprint: fingerprint,
      terminationSnapshot: {
        ...preview,
        ...values,
        feeCents,
        totalCents,
        settlementOrderId,
        actorId: staffUserId,
      },
    },
  });
  return { contractId: contract.id, studentId: contract.studentId };
}
