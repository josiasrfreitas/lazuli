import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { softDeleteExtension, withActiveRecordFilter } from "../src/soft-delete.js";

void describe("soft-delete read filter", () => {
  void it("adds the active-record condition to an existing where clause", () => {
    assert.deepEqual(withActiveRecordFilter({ where: { status: "ACTIVE" } }), {
      where: { status: "ACTIVE", deletedAt: null },
    });
  });

  void it("preserves an explicit deleted-record filter", () => {
    const arguments_ = { where: { deletedAt: { not: null } } };

    assert.equal(withActiveRecordFilter(arguments_), arguments_);
  });

  void it("filters reads for domain models through the Prisma extension interface", async () => {
    const result = await softDeleteExtension.query.$allModels.$allOperations({
      model: "Student",
      operation: "findMany",
      args: { where: { status: "ACTIVE" } },
      query: (arguments_) => Promise.resolve(arguments_),
    });

    assert.deepEqual(result, {
      where: { status: "ACTIVE", deletedAt: null },
    });
  });

  void it("does not filter Better Auth adapter models", async () => {
    const arguments_ = { where: { id: "account-id" } };
    const result = await softDeleteExtension.query.$allModels.$allOperations({
      model: "Account",
      operation: "findUnique",
      args: arguments_,
      query: (queryArguments) => Promise.resolve(queryArguments),
    });

    assert.equal(result, arguments_);
  });
});

void it("does not inject soft deletion into immutable financial treatment history", async () => {
  for (const operation of ["findMany", "findFirst", "count"] as const) {
    const args = { where: { installmentId: "installment-id" } };
    const result = await softDeleteExtension.query.$allModels.$allOperations({
      model: "InstallmentAgreement",
      operation,
      args,
      query: (queryArgs) => Promise.resolve(queryArgs),
    });
    assert.deepEqual(result, args);
  }
});

void it("keeps immutable material snapshots readable without a deletedAt column", async () => {
  const args = { where: { commandId: "material-command" } };
  const result = await softDeleteExtension.query.$allModels.$allOperations({
    model: "MaterialOrder",
    operation: "findUnique",
    args,
    query: (queryArgs) => Promise.resolve(queryArgs),
  });
  assert.deepEqual(result, args);
});
