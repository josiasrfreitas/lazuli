import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { after, before, it } from "node:test";
import { db, type TransactionClient } from "@lazuli/db";
import { finance } from "../../src/finance/index.js";
import { ADMIN, ensureAdminUser } from "../support/finance-test-support.js";

const ADULT_VERSION = createHash("sha256").update('["single-receipt-v1",6,13600,10]').digest("hex");
const CHILD_VERSION = createHash("sha256").update('["single-receipt-v1",6,12300,10]').digest("hex");
const NOW = new Date("2026-02-02T12:00:00Z");
const ROLLBACK = new Error("Rollback isolated material scenario");
const prices = {
  childMaterialInstallments: 6,
  childMaterialInstallmentCents: 12300,
  adultMaterialInstallments: 6,
  adultMaterialInstallmentCents: 13600,
  materialCardFeePct: 10,
};
async function scenario(
  run: (tx: TransactionClient, data: Awaited<ReturnType<typeof fixture>>) => Promise<void>,
): Promise<void> {
  try {
    await db.$transaction(
      async (tx) => {
        await run(tx, await fixture(tx));
        throw ROLLBACK;
      },
      { timeout: 20000 },
    );
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  }
}
async function fixture(tx: TransactionClient): Promise<{
  stageId: string;
  values: {
    commandId: string;
    studentId: string;
    payerId: string;
    agreedOn: string;
    startsOn: string;
    firstDueDate: string;
    durationMonths: number;
    monthlyAmountCents: number;
  };
}> {
  const suffix = randomUUID();
  const product = await tx.productLine.create({
    data: {
      key: suffix,
      name: suffix,
      tracks: {
        create: {
          name: "Adultos / English Main",
          stages: { create: { name: "Essentials 1", internalCode: "E1", sequence: 1 } },
        },
      },
    },
    include: { tracks: { include: { stages: true } } },
  });
  const stageId = product.tracks[0]!.stages[0]!.id;
  const payer = await tx.payer.create({ data: { name: `Material payer ${suffix}` } });
  const student = await tx.student.create({
    data: { fullName: `Material student ${suffix}`, status: "ACTIVE" },
  });
  const settings = {
    ...prices,
    tuitionCeilingCents: 25000,
    maximumDiscountPct: 20,
    punctualityDiscountPct: 8,
    interestRatePctMonthly: 2,
    cancellationFeePct: 20,
  };
  await tx.financeSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...settings },
    update: settings,
  });
  return {
    stageId,
    values: {
      commandId: randomUUID(),
      studentId: student.id,
      payerId: payer.id,
      agreedOn: "2026-01-01",
      startsOn: "2026-01-31",
      firstDueDate: "2026-01-31",
      durationMonths: 12,
      monthlyAmountCents: 25000,
    },
  };
}
void before(ensureAdminUser);
void after(() => db.$disconnect());

void it("keeps card installments as terms and creates one net receivable with stable prices and retry safety", async () => {
  await scenario(async (tx, { stageId, values }) => {
    const service = finance(tx, ADMIN.id);
    const input = {
      ...values,
      material: {
        stageIds: [stageId],
        category: "ADULT" as const,
        payment: "INSTALLMENTS" as const,
        installmentCount: 6,
        quoteVersion: ADULT_VERSION,
        expectedTotalCents: 81600,
      },
    };
    const contract = await service.createMonthlyContract(input);
    const detail = await service.readContract(contract.id, NOW);
    assert.equal(detail.materialAmountCents, 73440);
    const book = detail.orders.find((order) => order.kind === "MATERIAL")!;
    assert.equal(book.installments.length, 1);
    assert.deepEqual(detail.paymentProgress, { paid: 0, total: 12, waived: 0, cancelled: 0 });
    const [preview] = await service.previewPayments(
      { date: "2026-02-02", items: [{ installmentId: book.installments[0]!.id }] },
      NOW,
    );
    const late = preview!.line!;
    assert.equal(late.quote.newInterestCents, 0);
    assert.equal(late.quote.discountCents, 0);
    assert.deepEqual(late.materialReceipt, {
      name: "Essentials 1",
      chargedCents: 81600,
      feeCents: 8160,
      netCents: 73440,
    });
    assert.equal(detail.principalAmountCents, 300000);
    assert.deepEqual(
      detail.calendar.slice(0, 3).map((row) => [row.dueDate, row.tuitionCents, row.materialCents]),
      [
        ["2026-01-31", 25000, 73440],
        ["2026-02-28", 25000, 0],
        ["2026-03-31", 25000, 0],
      ],
    );
    assert.equal(detail.calendar[6]!.materialCents, 0);
    const pendingSummary = await service.studentSummary({ studentId: values.studentId, now: NOW });
    assert.deepEqual(
      pendingSummary.contracts[0]!.schedules.find((row) => row.kind === "MATERIAL")!.collection,
      {
        receivedCents: 0,
        balanceCents: 73440,
        paidCount: 0,
        waivedCount: 0,
        overdueCount: 1,
        count: 1,
      },
    );
    await tx.financeSettings.update({
      where: { id: "singleton" },
      data: { adultMaterialInstallmentCents: 15000 },
    });
    const replay = await service.createMonthlyContract(input);
    assert.equal(replay.id, contract.id);
    assert.equal(replay.materialAmountCents, 73440);
    assert.equal(
      await tx.materialOrder.count({ where: { order: { contractId: contract.id } } }),
      1,
    );
    await assert.rejects(
      service.createMonthlyContract({ ...input, commandId: randomUUID() }),
      /preço do material mudou/,
    );
    assert.equal(await tx.contract.count({ where: { studentId: values.studentId } }), 1);
    // Same total, different installment schedule must also invalidate the quote.
    await tx.financeSettings.update({
      where: { id: "singleton" },
      data: { adultMaterialInstallments: 3, adultMaterialInstallmentCents: 27200 },
    });
    await assert.rejects(
      service.createMonthlyContract({ ...input, commandId: randomUUID() }),
      /preço do material mudou/,
    );
    const renewal = await service.createMonthlyContract({
      ...values,
      commandId: randomUUID(),
      renewedFromId: contract.id,
      startsOn: "2027-02-01",
      firstDueDate: "2027-02-28",
    });
    assert.equal(renewal.materialAmountCents, 0);
    assert.deepEqual(renewal.materials, []);
    const receipt = {
      operationId: randomUUID(),
      date: "2026-02-02",
      method: "RECURRING_CREDIT" as const,
      receipts: [
        {
          commandId: randomUUID(),
          payerId: values.payerId,
          amountCents: 73440,
          allocations: [
            { installmentId: book.installments[0]!.id, amountCents: 73440, version: late.version },
          ],
        },
      ],
    };
    // Agreeing the sale did not record money. The full net is collected only now.
    assert.equal(
      await tx.paymentAllocation.count({ where: { installmentId: book.installments[0]!.id } }),
      0,
    );
    const received = await service.confirmPayments(receipt, NOW);
    assert.equal(received[0]!.amountCents, 73440);
    assert.deepEqual(await service.confirmPayments(receipt, NOW), received);
    assert.equal(
      await tx.paymentAllocation.count({ where: { installmentId: book.installments[0]!.id } }),
      1,
    );
    const paid = await service.readContract(contract.id, NOW);
    const paidBook = paid.orders.find((order) => order.kind === "MATERIAL")!;
    assert.equal(paidBook.installments[0]!.balanceCents, 0);
    assert.equal(paidBook.installments[0]!.paidCents, 73440);
    const paidSummary = await service.studentSummary({ studentId: values.studentId, now: NOW });
    assert.deepEqual(
      paidSummary.contracts
        .find((row) => row.id === contract.id)!
        .schedules.find((row) => row.kind === "MATERIAL")!.collection,
      {
        receivedCents: 73440,
        balanceCents: 0,
        paidCount: 1,
        waivedCount: 0,
        overdueCount: 0,
        count: 1,
      },
    );
    assert.deepEqual(paid.paymentProgress, { paid: 0, total: 12, waived: 0, cancelled: 0 });
  });
});

void it("charges the cash price once and never grants tuition punctuality discount on the book", async () => {
  await scenario(async (tx, { stageId, values }) => {
    const service = finance(tx, ADMIN.id);
    const contract = await service.createMonthlyContract({
      ...values,
      material: {
        stageIds: [stageId],
        category: "CHILD",
        payment: "CASH",
        installmentCount: 1,
        quoteVersion: CHILD_VERSION,
        expectedTotalCents: 66420,
      },
    });
    const detail = await service.readContract(contract.id, NOW);
    const material = detail.orders.find((order) => order.kind === "MATERIAL")!;
    assert.equal(material.totalCents, 66420);
    assert.equal(material.installments.length, 1);
    assert.equal(material.installments[0]!.dueDate, "2026-01-31");
    const installmentId = material.installments[0]!.id;
    const [preview] = await service.previewPayments(
      { date: "2026-01-31", items: [{ installmentId }] },
      NOW,
    );
    const line = preview!.line!;
    assert.equal(line.quote.balanceCents, 66420);
    assert.equal(line.quote.discountCents, 0);
    assert.equal(line.materialReceipt?.feeCents, 0);
    const ledger = await service.installments(
      { view: "all", page: 1, pageSize: 25, studentId: values.studentId },
      new Date("2026-01-31T12:00:00Z"),
    );
    assert.equal(ledger.view, "all");
    assert.ok("rows" in ledger);
    assert.equal(
      ledger.rows.find((row) => row.installmentId === installmentId)!.onTimeAmountCents,
      null,
    );
    await tx.installment.updateMany({
      where: { order: { contractId: contract.id, kind: "TUITION" } },
      data: {
        waivedAt: NOW,
        waivedReason: "Mensalidades dispensadas no cenário de cobrança do material",
      },
    });
    const overdue = await service.listContracts({
      page: 1,
      studentId: values.studentId,
      status: "INADIMPLENTE",
      now: NOW,
    });
    // The contracts listing tracks tuition only; material debt remains in student finance.
    assert.deepEqual(overdue.rows, []);
    const studentFinance = await service.studentSummary({ studentId: values.studentId, now: NOW });
    assert.equal(studentFinance.overdueCents, 66420);
    // Closing educational service does not forgive or prevent collection of the acquired book.
    const termination = await service.previewTermination(contract.id, NOW);
    await service.confirmTermination(
      {
        contractId: contract.id,
        commandId: randomUUID(),
        version: termination.version,
        feePct: 0,
        retainedChargesCents: 0,
        dueDate: "2026-02-02",
        enrollmentIds: [],
        reason: "Encerramento do serviço preservando a cobrança do livro adquirido.",
        acknowledged: true,
      },
      NOW,
    );
    const [afterTermination] = await service.previewPayments(
      { date: "2026-02-02", items: [{ installmentId }] },
      NOW,
    );
    assert.equal(afterTermination!.line!.quote.balanceCents, 66420);
  });
});

void it("adds only one receivable on the contract day for a later card acquisition", async () => {
  await scenario(async (tx, { stageId, values }) => {
    const service = finance(tx, ADMIN.id);
    const contract = await service.createMonthlyContract({
      ...values,
      material: {
        stageIds: [stageId],
        category: "ADULT",
        payment: "CASH",
        installmentCount: 1,
        quoteVersion: ADULT_VERSION,
        expectedTotalCents: 73440,
      },
    });
    const acquisition = {
      commandId: randomUUID(),
      contractId: contract.id,
      firstDueDate: "2026-02-28",
      material: {
        stageIds: [stageId],
        category: "ADULT" as const,
        payment: "INSTALLMENTS" as const,
        installmentCount: 6,
        quoteVersion: ADULT_VERSION,
        expectedTotalCents: 81600,
      },
    };
    const added = await service.addContractMaterial(acquisition);
    assert.deepEqual(await service.addContractMaterial(acquisition), added);
    const detail = await service.readContract(contract.id, NOW);
    assert.deepEqual(
      detail.orders
        .find((order) => order.id === added.orderId)!
        .installments.slice(0, 3)
        .map((row) => row.dueDate),
      ["2026-02-28"],
    );
    await assert.rejects(
      service.addContractMaterial({
        ...acquisition,
        commandId: randomUUID(),
        firstDueDate: "2026-03-28",
      }),
      /dia de vencimento do contrato/,
    );
    await assert.rejects(
      service.addContractMaterial({
        ...acquisition,
        material: { ...acquisition.material, payment: "CASH", expectedTotalCents: 73440 },
      }),
      /dados diferentes/,
    );
    assert.equal(
      await tx.materialOrder.count({ where: { order: { contractId: contract.id } } }),
      2,
    );
  });
});

void it("sells two books together over six agreed card installments with one net repasse", async () => {
  await scenario(async (tx, { stageId, values }) => {
    const stage = await tx.stage.findUniqueOrThrow({ where: { id: stageId } });
    const second = await tx.stage.create({
      data: { trackId: stage.trackId, name: "Essentials 2", internalCode: "E2", sequence: 2 },
    });
    const service = finance(tx, ADMIN.id);
    for (const price of [
      {
        category: "ADULT" as const,
        version: ADULT_VERSION,
        gross: 163200,
        fee: 16320,
        net: 146880,
        unit: 13600,
      },
      {
        category: "CHILD" as const,
        version: CHILD_VERSION,
        gross: 147600,
        fee: 14760,
        net: 132840,
        unit: 12300,
      },
    ]) {
      const contract = await service.createMonthlyContract({
        ...values,
        commandId: randomUUID(),
        material: {
          stageIds: [stageId, second.id],
          category: price.category,
          payment: "INSTALLMENTS",
          installmentCount: 6,
          quoteVersion: price.version,
          expectedTotalCents: price.gross,
        },
      });
      const detail = await service.readContract(contract.id, NOW);
      const books = detail.orders.filter((row) => row.kind === "MATERIAL");
      assert.equal(books.length, 1);
      assert.deepEqual(
        books[0]!.material!.items.map((item) => item.name),
        ["Essentials 1", "Essentials 2"],
      );
      assert.equal(books[0]!.material!.quotedInstallments, 6);
      assert.equal(books[0]!.material!.quotedInstallmentCents, price.unit * 2);
      assert.equal(books[0]!.material!.cardFeeCents, price.fee);
      assert.equal(books[0]!.installments.length, 1);
      assert.equal(books[0]!.installments[0]!.amountCents, price.net);
      const installmentId = books[0]!.installments[0]!.id;
      const [preview] = await service.previewPayments(
        { date: "2026-02-02", items: [{ installmentId }] },
        NOW,
      );
      const line = preview!.line!;
      await service.confirmPayments(
        {
          operationId: randomUUID(),
          method: "RECURRING_CREDIT",
          date: "2026-02-02",
          receipts: [
            {
              commandId: randomUUID(),
              payerId: values.payerId,
              amountCents: price.net,
              allocations: [{ installmentId, amountCents: price.net, version: line.version }],
            },
          ],
        },
        NOW,
      );
      const summary = await service.studentSummary({ studentId: values.studentId, now: NOW });
      const sale = summary.contracts
        .find((row) => row.id === contract.id)!
        .schedules.find((row) => row.kind === "MATERIAL")!;
      assert.equal(sale.collection.balanceCents, 0);
      assert.equal(sale.collection.receivedCents, price.net);
      assert.equal(sale.collection.paidCount, 1);
    }
  });
});

void it("allows three books in one sale without generating three school receivables", async () => {
  await scenario(async (tx, { stageId, values }) => {
    const stage = await tx.stage.findUniqueOrThrow({ where: { id: stageId } });
    const other = await Promise.all(
      [2, 3].map((sequence) =>
        tx.stage.create({
          data: {
            trackId: stage.trackId,
            name: `Book ${sequence}`,
            internalCode: `B${sequence}`,
            sequence,
          },
        }),
      ),
    );
    const service = finance(tx, ADMIN.id);
    const contract = await service.createMonthlyContract({
      ...values,
      material: {
        stageIds: [stageId, ...other.map((row) => row.id)],
        category: "ADULT",
        payment: "INSTALLMENTS",
        installmentCount: 6,
        quoteVersion: ADULT_VERSION,
        expectedTotalCents: 244800,
      },
    });
    const detail = await service.readContract(contract.id, NOW);
    const sale = detail.orders.filter((row) => row.kind === "MATERIAL");
    assert.equal(sale.length, 1);
    assert.equal(sale[0]!.material!.items.length, 3);
    assert.equal(sale[0]!.material!.quotedInstallments, 6);
    assert.equal(sale[0]!.installments.length, 1);
    assert.equal(sale[0]!.totalCents, 220320);
  });
});

for (const scheduleType of ["REGULAR", "PERSONALIZED"] as const) {
  void it(`uses the ${scheduleType} academic plan instead of contract duration for material attention`, async () => {
    await scenario(async (tx, { stageId, values }) => {
      const stage = await tx.stage.findUniqueOrThrow({ where: { id: stageId } });
      const next = await tx.stage.create({
        data: { trackId: stage.trackId, name: "Essentials 2", internalCode: "E2", sequence: 2 },
      });
      const semester = await tx.period.create({
        data: {
          name: randomUUID(),
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-06-30"),
        },
      });
      const group = await tx.class.create({
        data: {
          internalCode: randomUUID(),
          portalClassName: "Material planning",
          teacherId: ADMIN.id,
          scheduleType,
          format: "IN_PERSON",
          sharedStageId: scheduleType === "REGULAR" ? stageId : null,
          semesterId: semester.id,
          year: 2026,
          capacity: 20,
        },
      });
      const enrollment = await tx.enrollment.create({
        data: {
          studentId: values.studentId,
          classId: group.id,
          entryDate: new Date("2026-01-01"),
          progressRecords: { create: { stageId, startDate: new Date("2026-01-01") } },
        },
        include: { progressRecords: true },
      });
      const plan = await tx.stagePlan.create({
        data: {
          classId: scheduleType === "REGULAR" ? group.id : null,
          studentId: scheduleType === "PERSONALIZED" ? values.studentId : null,
          stageId,
          plannedStartOn: new Date("2026-01-01"),
          plannedEndOn: new Date("2026-02-28"),
          createdById: ADMIN.id,
        },
      });
      if (scheduleType === "PERSONALIZED")
        await tx.pedagogicalProgress.update({
          where: { id: enrollment.progressRecords[0]!.id },
          data: { stagePlanId: plan.id },
        });
      else {
        await tx.semesterPlacement.create({
          data: {
            semesterId: semester.id,
            studentId: values.studentId,
            trackId: stage.trackId,
            stageId,
            sourceEnrollmentId: enrollment.id,
            sourceProgressId: enrollment.progressRecords[0]!.id,
            mode: "ENTRY",
            effectiveDate: new Date("2026-01-01"),
            recordedById: ADMIN.id,
          },
        });
        const withoutDestination = await finance(tx, ADMIN.id).studentSummary({
          studentId: values.studentId,
          now: NOW,
        });
        assert.equal(withoutDestination.materialNeeds.length, 1);
        assert.equal(withoutDestination.materialNeeds[0]!.nextStage, null);
        assert.equal(withoutDestination.materialNeeds[0]!.stagePending, true);
        const nextSemester = await tx.period.create({
          data: {
            name: randomUUID(),
            startDate: new Date("2026-07-01"),
            endDate: new Date("2026-12-31"),
          },
        });
        await tx.semesterPlacement.create({
          data: {
            semesterId: nextSemester.id,
            studentId: values.studentId,
            trackId: stage.trackId,
            stageId: next.id,
            sourceEnrollmentId: enrollment.id,
            sourceProgressId: enrollment.progressRecords[0]!.id,
            mode: "ADVANCE",
            recordedById: ADMIN.id,
          },
        });
      }
      const service = finance(tx, ADMIN.id);
      const contract = await service.createMonthlyContract({
        ...values,
        material: {
          stageIds: [stageId],
          category: "ADULT",
          payment: "CASH",
          installmentCount: 1,
          quoteVersion: ADULT_VERSION,
          expectedTotalCents: 73440,
        },
      });
      const summary = await service.studentSummary({ studentId: values.studentId, now: NOW });
      assert.equal(summary.materialNeeds.length, 1);
      assert.equal(summary.materialNeeds[0]!.plannedEndOn, "2026-02-28");
      assert.equal(summary.materialNeeds[0]!.nextStage, "Essentials 2");
      // Moving the academic plan, with the same class and same twelve-month contract, removes attention.
      await tx.stagePlan.update({
        where: { id: plan.id },
        data: { plannedEndOn: new Date("2026-06-01") },
      });
      const coveredSummary = await service.studentSummary({
        studentId: values.studentId,
        now: NOW,
      });
      assert.deepEqual(coveredSummary.materialNeeds, []);
      await tx.stagePlan.update({
        where: { id: plan.id },
        data: { plannedEndOn: new Date("2026-02-28") },
      });
      // Agreeing the next book is enough: an unpaid sale must not prompt a duplicate purchase.
      await service.addContractMaterial({
        commandId: randomUUID(),
        contractId: contract.id,
        firstDueDate: "2026-02-28",
        material: {
          stageIds: [next.id],
          category: "ADULT",
          payment: "INSTALLMENTS",
          installmentCount: 6,
          quoteVersion: ADULT_VERSION,
          expectedTotalCents: 81600,
        },
      });
      const covered = await service.studentSummary({ studentId: values.studentId, now: NOW });
      assert.deepEqual(covered.materialNeeds, []);
      assert.equal(
        covered.contracts[0]!.schedules.find((row) => row.kind === "MATERIAL")!.collection
          .receivedCents,
        0,
      );
    });
  });
}

void it("persists a negotiated total and tracks material across renewal, including a stage without a class", async () => {
  await scenario(async (tx, { stageId, values }) => {
    const first = await tx.stage.findUniqueOrThrow({ where: { id: stageId } });
    const second = await tx.stage.create({
      data: { trackId: first.trackId, name: "Essentials 2", internalCode: "E2", sequence: 2 },
    });
    const third = await tx.stage.create({
      data: { trackId: first.trackId, name: "Transitions 1", internalCode: "T1", sequence: 3 },
    });
    const semester = await tx.period.create({
      data: {
        name: randomUUID(),
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-06-30"),
      },
    });
    await tx.semesterPlacement.create({
      data: {
        semesterId: semester.id,
        studentId: values.studentId,
        trackId: first.trackId,
        stageId,
        mode: "ENTRY",
        recordedById: ADMIN.id,
      },
    });
    const service = finance(tx, ADMIN.id);
    const empty = await service.studentMaterials({ studentId: values.studentId, now: NOW });
    assert.equal(empty.current[0]!.id, stageId);
    assert.equal(empty.current[0]!.acquired, false);
    assert.equal(empty.suggestedStageId, stageId);
    const initial = await service.createMonthlyContract({
      ...values,
      material: {
        stageIds: [stageId, second.id],
        category: "ADULT",
        payment: "INSTALLMENTS",
        installmentCount: 6,
        quoteVersion: ADULT_VERSION,
        expectedTotalCents: 163200,
        priceOverrideCents: 150001,
      },
    });
    const detail = await service.readContract(initial.id, NOW);
    const order = detail.orders.find((row) => row.kind === "MATERIAL")!;
    assert.equal(order.material!.chargedAmountCents, 166668);
    assert.equal(order.material!.quotedInstallments, 6);
    assert.equal(order.material!.quotedInstallmentCents, 27778);
    assert.equal(order.installments.length, 1);
    assert.equal(order.totalCents, 150001);
    const pricedMaterial = await tx.materialOrder.findUniqueOrThrow({
      where: { orderId: order.id },
    });
    assert.equal(pricedMaterial.priceOverrideCents, 150001);
    assert.equal((await service.readMaterialPrice())!.adult.cashCents, 73440);
    const renewed = await service.createMonthlyContract({
      ...values,
      commandId: randomUUID(),
      renewedFromId: initial.id,
      startsOn: "2027-02-01",
      firstDueDate: "2027-02-28",
    });
    assert.equal(renewed.materialAmountCents, 0);
    const status = await service.studentMaterials({ studentId: values.studentId, now: NOW });
    assert.equal(status.acquiredCount, 2);
    assert.equal(status.current[0]!.acquired, true);
    assert.equal(status.next[0]!.id, second.id);
    assert.equal(status.next[0]!.acquired, true);
    assert.equal(status.nextAcquisitions[0]!.id, third.id);
    assert.equal(status.nextAcquisitions[0]!.source, "SEQUENCE");
    assert.equal(status.acquisitions[0]!.installmentCount, 6);
    await service.addContractMaterial({
      commandId: randomUUID(),
      contractId: renewed.id,
      firstDueDate: "2027-02-28",
      material: {
        stageIds: [third.id],
        category: "ADULT",
        payment: "CASH",
        installmentCount: 1,
        quoteVersion: ADULT_VERSION,
        expectedTotalCents: 73440,
        priceOverrideCents: 70000,
      },
    });
    const covered = await service.studentMaterials({ studentId: values.studentId, now: NOW });
    assert.equal(covered.acquiredCount, 3);
    assert.deepEqual(covered.nextAcquisitions, []);
  });
});

void it("rejects an initial contract without material before persisting it", async () => {
  await scenario(async (tx, { values }) => {
    await assert.rejects(finance(tx, ADMIN.id).createMonthlyContract(values), /Inclua o material/);
    assert.equal(await tx.contract.count({ where: { studentId: values.studentId } }), 0);
  });
});

void it("records bank installments on one receipt and keeps one material charge", async () => {
  await scenario(async (tx, { stageId, values }) => {
    const credit = await tx.paymentMethod.findUniqueOrThrow({ where: { code: "CREDIT" } });
    assert.equal(credit.active, true);
    assert.equal(credit.allowsExternalInstallments, true);
    const service = finance(tx, ADMIN.id);
    const contract = await service.createMonthlyContract({
      ...values,
      material: {
        stageIds: [stageId],
        category: "ADULT",
        payment: "INSTALLMENTS",
        installmentCount: 6,
        quoteVersion: ADULT_VERSION,
        expectedTotalCents: 81600,
        priceOverrideCents: 150000,
      },
    });
    const charge = await tx.installment.findFirstOrThrow({
      where: { order: { contractId: contract.id, kind: "MATERIAL" } },
    });
    const listed = await service.installments(
      { view: "all", page: 1, pageSize: 25, studentId: values.studentId },
      NOW,
    );
    if (listed.view !== "all") throw new Error("Expected individual charges");
    assert.deepEqual(listed.rows.find((row) => row.installmentId === charge.id)?.material, {
      name: "Essentials 1",
      payment: "INSTALLMENTS",
      installmentCount: 6,
    });
    const [preview] = await service.previewPayments(
      { date: "2026-02-02", items: [{ installmentId: charge.id }] },
      NOW,
    );
    assert.ok(preview?.line);
    assert.equal(preview.line.quote.receivedCents, 150000);
    const command = {
      operationId: randomUUID(),
      date: "2026-02-02",
      method: "CREDIT",
      receipts: [
        {
          commandId: randomUUID(),
          payerId: values.payerId,
          amountCents: 150000,
          externalInstallments: 6,
          allocations: [
            { installmentId: charge.id, amountCents: 150000, version: preview.line.version },
          ],
        },
      ],
    };
    await assert.rejects(
      service.confirmPayments({ ...command, method: "PIX" }, NOW),
      /não permite parcelamento por terceiros/,
    );
    assert.equal(await tx.paymentEntry.count({ where: { payerId: values.payerId } }), 0);
    const [receipt] = await service.confirmPayments(command, NOW);
    assert.ok(receipt);
    assert.equal(receipt.externalInstallments, 6);
    assert.equal(receipt.amountCents, 150000);
    const replay = await service.confirmPayments(command, NOW);
    assert.equal(replay[0]?.id, receipt.id);
    assert.equal(replay[0]?.externalInstallments, 6);
    assert.equal(await tx.paymentEntry.count({ where: { payerId: values.payerId } }), 1);
    assert.equal(await tx.installment.count({ where: { orderId: charge.orderId } }), 1);
    const allocation = await tx.paymentAllocation.findFirstOrThrow({
      where: { paymentEntryId: receipt.id },
    });
    assert.equal(allocation.amountCents, 150000);
    const chargedMaterial = await tx.materialOrder.findUniqueOrThrow({
      where: { orderId: charge.orderId },
    });
    assert.equal(chargedMaterial.chargedAmountCents, 166667);
  });
});
