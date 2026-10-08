import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { softDeleteExtension } from "../src/soft-delete.js";

void describe("soft-delete read filter", () => {
  void it("adds the active-record filter to a UUID entity read", async () => {
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

  void it("keeps an explicit deleted-record filter on a UUID entity read", async () => {
    const arguments_ = { where: { deletedAt: { not: null } } };
    const result = await softDeleteExtension.query.$allModels.$allOperations({
      model: "Student",
      operation: "findMany",
      args: arguments_,
      query: (queryArguments) => Promise.resolve(queryArguments),
    });

    assert.deepEqual(result, arguments_);
  });

  void it("does not filter Better Auth adapter models", async () => {
    const arguments_ = { where: { id: "account-id" } };
    const result = await softDeleteExtension.query.$allModels.$allOperations({
      model: "Account",
      operation: "findUnique",
      args: arguments_,
      query: (queryArguments) => Promise.resolve(queryArguments),
    });

    assert.deepEqual(result, arguments_);
  });
});
