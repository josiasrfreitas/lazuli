import { materialOrderData, receiveNewMaterial } from "./contract-materials.js";
import { searchIds } from "../../search.js";
import { createHash } from "node:crypto";

import {
  saoPauloDateOnly,
  previewMonthlyContract,
  type ContractFinancialStatus,
} from "@lazuli/domain";
import type { FinanceSettings, Prisma } from "@lazuli/db";
import type { CreateMonthlyContractInput } from "@lazuli/validators";
import { TRPCError } from "@trpc/server";

import { contractSelect, toRow, type ContractListRow } from "./contracts-select.js";
import { groupedContractPage } from "./grouped-contract-page.js";
import { contractStatusPage } from "./contract-status-page.js";
import { createStudent } from "../../students/data.js";
import { createContractPayer } from "./payers.js";
import { toDateOnly, type FinanceDatabase } from "./shared.js";
import { assertCreationCommandOwner, lockCreationCommand } from "../../creation-command.js";

const ISO_DATE_LENGTH = 10;

const DUE_DAY_START = 8;
const DUE_DAY_END = 10;

export function contractFingerprint(values: CreateMonthlyContractInput): string {
  return createHash("sha256").update(JSON.stringify(values)).digest("hex");
}

export async function findCommandResult(
  database: FinanceDatabase,
  values: CreateMonthlyContractInput,
): Promise<ContractListRow | null> {
  await assertCreationCommandOwner(database, { id: values.commandId, owner: "contract" });
  const existing = await database.contract.findUnique({
    where: { commandId: values.commandId },
    select: contractSelect,
  });
  if (!existing) return null;
  if (existing.commandFingerprint !== contractFingerprint(values)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Identidade de criação usada com dados diferentes.",
    });
  }
  return toRow(existing);
}

type ReadyTerms = {
  settings: FinanceSettings;
  preview: ReturnType<typeof previewMonthlyContract>;
};
type PriorContract = Prisma.ContractGetPayload<Record<string, never>>;
type ReadySettings = FinanceSettings & {
  tuitionCeilingCents: number;
  maximumDiscountPct: NonNullable<FinanceSettings["maximumDiscountPct"]>;
  interestRatePctMonthly: NonNullable<FinanceSettings["interestRatePctMonthly"]>;
  cancellationFeePct: NonNullable<FinanceSettings["cancellationFeePct"]>;
};

async function assertContractParties(
  database: FinanceDatabase,
  values: CreateMonthlyContractInput,
): Promise<void> {
  const [payer, student] = await Promise.all([
    values.payerId
      ? database.payer.findFirst({
          where: { id: values.payerId, deletedAt: null },
          select: { id: true },
        })
      : null,
    values.studentId
      ? database.student.findFirst({
          where: { id: values.studentId, deletedAt: null },
          select: { id: true },
        })
      : null,
  ]);
  if ((!payer && !values.newPayer) || (!student && !values.newStudent))
    throw new TRPCError({ code: "NOT_FOUND", message: "Aluno ou pagador não encontrado." });
}

async function readyTerms(input: {
  database: FinanceDatabase;
  values: CreateMonthlyContractInput;
}): Promise<ReadyTerms> {
  const { database, values } = input;
  const [schoolSettings] = await Promise.all([
    database.financeSettings.findUnique({ where: { id: "singleton" } }),
    assertContractParties(database, values),
  ]);
  const prior = await renewalPrior(database, values);
  if (!prior && !values.material && !values.books) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Inclua o material para criar um novo contrato.",
    });
  }
  if (prior && (values.enrollmentFeeCents ?? 0) > 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "A rematrícula é gratuita." });
  }
  const settings = priorSettings(schoolSettings, prior);
  assertReadySettings(settings);
  if (
    values.punctualityDiscountPct !== undefined &&
    values.punctualityDiscountPct !== Number(settings.punctualityDiscountPct)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "O desconto por pontualidade é definido nos ajustes financeiros.",
    });
  }
  return { settings, preview: monthlyPreview(values, settings) };
}

async function renewalPrior(
  database: FinanceDatabase,
  values: CreateMonthlyContractInput,
): Promise<PriorContract | null> {
  if (values.renewedFromId)
    await database.$queryRaw`SELECT id FROM "Contract" WHERE id = ${values.renewedFromId}::uuid FOR UPDATE`;
  const prior = values.renewedFromId
    ? await database.contract.findFirst({
        where: {
          id: values.renewedFromId,
          deletedAt: null,
          ...(values.studentId === undefined ? {} : { studentId: values.studentId }),
          terminatedAt: null,
        },
      })
    : null;
  assertPriorCanRenew(prior, values);
  if (prior) {
    await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`contract-renewal:${prior.id}`}, 0))`;
    const existing = await database.contract.findFirst({
      where: { renewedFromId: prior.id, deletedAt: null, terminatedAt: null },
    });
    if (existing)
      throw new TRPCError({
        code: "CONFLICT",
        message: "Este contrato já possui uma renovação. Consulte o financeiro do aluno.",
      });
  }
  return prior;
}

function assertPriorCanRenew(
  prior: PriorContract | null,
  values: CreateMonthlyContractInput,
): void {
  if (
    values.renewedFromId &&
    (!prior ||
      !values.studentId ||
      !prior.endsOn ||
      values.startsOn <= prior.endsOn.toISOString().slice(0, ISO_DATE_LENGTH))
  )
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A renovação deve ser do mesmo aluno e começar após o contrato anterior.",
    });
}

function priorSettings(
  schoolSettings: FinanceSettings | null,
  prior: PriorContract | null,
): FinanceSettings | null {
  return prior && schoolSettings
    ? {
        ...schoolSettings,
        tuitionCeilingCents: prior.tuitionCeilingCents,
        maximumDiscountPct: prior.maximumDiscountPct,
        punctualityDiscountPct:
          prior.standardPunctualityDiscountPct ?? prior.punctualityDiscountPct!,
        interestRatePctMonthly: prior.interestRatePctMonthly,
        cancellationFeePct: prior.cancellationFeePct,
      }
    : schoolSettings;
}

function assertReadySettings(settings: FinanceSettings | null): asserts settings is ReadySettings {
  if (
    !settings ||
    settings.tuitionCeilingCents === null ||
    settings.maximumDiscountPct === null ||
    settings.punctualityDiscountPct === null ||
    settings.interestRatePctMonthly === null ||
    settings.cancellationFeePct === null
  ) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Configure os ajustes financeiros antes de criar um contrato.",
    });
  }
}

function monthlyPreview(
  values: CreateMonthlyContractInput,
  settings: ReadySettings,
): ReturnType<typeof previewMonthlyContract> {
  let preview: ReturnType<typeof previewMonthlyContract>;
  try {
    preview = previewMonthlyContract({
      ...values,
      punctualityDiscountPct: Number(settings.punctualityDiscountPct),
      tuitionCeilingCents: settings.tuitionCeilingCents,
      maximumDiscountPct: Number(settings.maximumDiscountPct),
    });
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Confira a mensalidade e a quantidade de parcelas autorizadas.",
    });
  }
  return preview;
}

type PersistContractInput = {
  studentId: string;
  payerId: string;
  database: FinanceDatabase;
  values: CreateMonthlyContractInput;
  staffUserId: string;
  terms: ReadyTerms;
};

function normalizedAgreement(agreement: string | null | undefined): string | null {
  return agreement?.trim() || null;
}

function plannedBooksData(
  books: PersistContractInput["values"]["books"],
): Pick<Prisma.ContractUncheckedCreateInput, "plannedBooks"> {
  if (!books) return {};
  return {
    plannedBooks: {
      create: books.map((book, index) => ({
        semester: index + 1,
        stageId: book.stageId,
        acquisitionSemester: book.acquisitionSemester,
        agreedPriceCents: book.agreedPriceCents ?? null,
      })),
    },
  };
}

async function persistContract(input: PersistContractInput): Promise<ContractListRow> {
  const { database, values, terms } = input;
  const { settings, preview } = terms;
  const orders = await contractOrders(input);
  const data: Prisma.ContractUncheckedCreateInput = {
    commandId: values.commandId,
    commandFingerprint: contractFingerprint(values),
    renewedFromId: values.renewedFromId ?? null,
    payerId: input.payerId,
    studentId: input.studentId,
    agreedOn: toDateOnly(values.agreedOn),
    startsOn: toDateOnly(values.startsOn),
    durationMonths: values.durationMonths,
    endsOn: toDateOnly(preview.endsOn),
    monthlyAmountCents: preview.chargedMonthlyCents,
    baseMonthlyAmountCents: values.monthlyAmountCents,
    scholarshipPct: values.scholarshipPct ?? 0,
    scholarshipAgreement: normalizedAgreement(values.scholarshipAgreement),
    tuitionCeilingCents: settings.tuitionCeilingCents,
    maximumDiscountPct: settings.maximumDiscountPct,
    punctualityDiscountPct:
      (values.scholarshipPct ?? 0) > 0 ? 0 : Number(settings.punctualityDiscountPct),
    standardPunctualityDiscountPct: settings.punctualityDiscountPct,
    interestRatePctMonthly: settings.interestRatePctMonthly,
    cancellationFeePct: settings.cancellationFeePct,
    ...plannedBooksData(values.books),
    orders: { create: orders },
  };
  const received = (values.books ?? []).flatMap((book) =>
    book.acquisition?.receivedMethod ? [book.acquisition] : [],
  );
  if (received.length === 0)
    return toRow(await database.contract.create({ data, select: contractSelect }));

  // Only material installment IDs and amounts are needed to post receipts.
  // Load the contract summary once, after all allocations are visible.
  const contract = await database.contract.create({
    data,
    select: {
      id: true,
      orders: {
        where: { kind: "MATERIAL", deletedAt: null },
        select: {
          material: { select: { stageId: true } },
          installments: {
            where: { deletedAt: null },
            orderBy: { sequenceNumber: "asc" },
            select: { id: true, amountCents: true },
          },
        },
      },
    },
  });
  for (const material of received) {
    const order = contract.orders.find((row) => row.material?.stageId === material.stageIds[0]);
    if (!order) throw new Error("Cobrança do material não encontrada.");
    await receiveNewMaterial({ ...input, order, material, date: values.agreedOn });
  }
  return toRow(
    await database.contract.findUniqueOrThrow({
      where: { id: contract.id },
      select: contractSelect,
    }),
  );
}

async function contractOrders(
  input: PersistContractInput,
): Promise<Prisma.OrderCreateWithoutContractInput[]> {
  const {
    database,
    values,
    staffUserId,
    terms: { settings, preview },
  } = input;
  const enrollmentFee = values.enrollmentFeeCents
    ? enrollmentFeeOrderData({ values, staffUserId })
    : null;
  const acquisitions =
    values.books?.flatMap((book) => (book.acquisition ? [book.acquisition] : [])) ??
    (values.material ? [values.material] : []);
  const materials = [];
  for (const material of acquisitions)
    materials.push(
      await materialOrderData({
        database,
        material,
        settings,
        firstDueDate: values.books ? values.agreedOn : values.firstDueDate,
        staffUserId,
      }),
    );
  return [
    ...(preview.principalAmountCents > 0
      ? [tuitionOrderData({ values, preview, staffUserId })]
      : []),
    ...(enrollmentFee ? [enrollmentFee] : []),
    ...materials,
  ];
}

function enrollmentFeeOrderData(input: {
  values: CreateMonthlyContractInput;
  staffUserId: string;
}): Prisma.OrderCreateWithoutContractInput {
  const { values, staffUserId } = input;
  const dueDate = toDateOnly(values.agreedOn);
  return {
    kind: "ENROLLMENT_FEE",
    principalAmountCents: values.enrollmentFeeCents!,
    startDate: dueDate,
    dueDay: Number(values.agreedOn.slice(DUE_DAY_START, DUE_DAY_END)),
    firstDueDate: dueDate,
    installmentCount: 1,
    createdBy: { connect: { id: staffUserId } },
    updatedBy: { connect: { id: staffUserId } },
    installments: {
      create: {
        sequenceNumber: 1,
        amountCents: values.enrollmentFeeCents!,
        dueDate,
        createdById: staffUserId,
        updatedById: staffUserId,
      },
    },
  };
}

function tuitionOrderData(input: {
  values: CreateMonthlyContractInput;
  preview: ReturnType<typeof previewMonthlyContract>;
  staffUserId: string;
}): Prisma.OrderCreateWithoutContractInput {
  const { values, preview, staffUserId } = input;
  return {
    kind: "TUITION",
    principalAmountCents: preview.principalAmountCents,
    startDate: toDateOnly(values.startsOn),
    dueDay: Number(values.firstDueDate.slice(DUE_DAY_START, DUE_DAY_END)),
    firstDueDate: toDateOnly(values.firstDueDate),
    installmentCount: preview.installments.length,
    createdBy: { connect: { id: staffUserId } },
    updatedBy: { connect: { id: staffUserId } },
    installments: {
      create: preview.installments.map((row) => ({
        sequenceNumber: row.sequenceNumber,
        amountCents: row.amountCents,
        dueDate: toDateOnly(row.dueDate),
        createdById: staffUserId,
        updatedById: staffUserId,
      })),
    },
  };
}

export async function createMonthlyContract(input: {
  database: FinanceDatabase;
  values: CreateMonthlyContractInput;
  staffUserId: string;
}): Promise<ContractListRow> {
  await lockCreationCommand(input.database, input.values.commandId);
  const prior = await findCommandResult(input.database, input.values);
  if (prior) return prior;
  const terms = await readyTerms(input);
  let studentId = input.values.studentId!;
  if (input.values.newStudent) {
    const student = await createStudent({
      database: input.database,
      values: input.values.newStudent,
    });
    studentId = student.id;
  }
  let payerId = input.values.payerId!;
  if (input.values.newPayer) {
    const payer = await createContractPayer({ ...input, values: input.values.newPayer });
    payerId = payer.id;
  }
  return persistContract({ ...input, terms, payerId, studentId });
}

type ContractListOptions = {
  page: number;
  query?: string;
  payerId?: string | undefined;
  studentId?: string | undefined;
  followUp?: boolean | undefined;
  grouped?: boolean | undefined;
  materialState?: "ACQUIRED" | "PLANNED" | undefined;
  scheduleType?: "REGULAR" | "PERSONALIZED" | undefined;
  startsFrom?: string | undefined;
  endsTo?: string | undefined;
  status?: ContractFinancialStatus | undefined;
  now?: Date;
};

function contractListWhere(options: ContractListOptions): Prisma.ContractWhereInput {
  const today = new Date(saoPauloDateOnly(options.now ?? new Date()));
  return {
    ...(options.scheduleType
      ? {
          student: {
            enrollments: {
              some: {
                deletedAt: null,
                entryDate: { lte: today },
                OR: [{ exitDate: null }, { exitDate: { gt: today } }],
                class: { scheduleType: options.scheduleType, deletedAt: null },
              },
            },
          },
        }
      : {}),
    commandId: { not: null },
    deletedAt: null,
    ...(options.payerId ? { payerId: options.payerId } : {}),
    ...(options.studentId ? { studentId: options.studentId } : {}),
    ...(options.startsFrom ? { endsOn: { gte: toDateOnly(options.startsFrom) } } : {}),
    ...(options.endsTo ? { startsOn: { lte: toDateOnly(options.endsTo) } } : {}),
  };
}

export async function listContracts(
  database: FinanceDatabase,
  options: ContractListOptions,
): Promise<{
  rows: ContractListRow[];
  page: number;
  pageSize: number;
  total: number;
}> {
  const { page, now = new Date() } = options;
  const pageSize = 25;
  if (options.grouped) {
    const grouped = await groupedContractPage(database, { ...options, now });
    const contracts = await database.contract.findMany({
      where: { id: { in: grouped.ids } },
      select: contractSelect,
    });
    const byId = new Map(contracts.map((contract) => [contract.id, contract]));
    return {
      rows: grouped.ids.flatMap((id) => {
        const row = byId.get(id);
        return row
          ? [
              {
                ...toRow(row, now),
                renewalPending: grouped.renewals.has(id),
                materialDue: grouped.materials.get(row.student.id) ?? null,
              },
            ]
          : [];
      }),
      page,
      pageSize,
      total: grouped.total,
    };
  }
  const where = contractListWhere(options);
  if (options.query) {
    const [students, payers] = await Promise.all([
      searchIds(database, { table: "Student", query: options.query }),
      searchIds(database, { table: "Payer", query: options.query }),
    ]);
    if (students !== undefined && payers !== undefined)
      where.OR = [{ student: { id: students } }, { payer: { id: payers } }];
  }
  if (options.status) {
    const match = await contractStatusPage(database, { ...options, status: options.status, now });
    const selected = await database.contract.findMany({
      where: { id: { in: match.ids } },
      select: contractSelect,
    });
    const byId = new Map(selected.map((row) => [row.id, row]));
    return {
      rows: match.ids.map((id) => {
        const row = byId.get(id);
        if (!row) throw new Error("Contrato filtrado não encontrado.");
        return toRow(row, now);
      }),
      page,
      pageSize,
      total: match.total,
    };
  }
  const [total, rows] = await Promise.all([
    database.contract.count({ where }),
    database.contract.findMany({
      where,
      select: contractSelect,
      orderBy: [{ agreedOn: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { rows: rows.map((row) => toRow(row, now)), page, pageSize, total };
}

export async function readContractOffer(database: FinanceDatabase): Promise<{
  tuitionCeilingCents: number;
  maximumDiscountPct: number;
  punctualityDiscountPct: number;
  interestRatePctMonthly: number;
  cancellationFeePct: number;
} | null> {
  const row = await database.financeSettings.findUnique({ where: { id: "singleton" } });
  if (
    !row ||
    row.tuitionCeilingCents === null ||
    row.maximumDiscountPct === null ||
    row.interestRatePctMonthly === null ||
    row.cancellationFeePct === null
  )
    return null;
  return {
    tuitionCeilingCents: row.tuitionCeilingCents,
    maximumDiscountPct: Number(row.maximumDiscountPct),
    punctualityDiscountPct: Number(row.punctualityDiscountPct),
    interestRatePctMonthly: Number(row.interestRatePctMonthly),
    cancellationFeePct: Number(row.cancellationFeePct),
  };
}
