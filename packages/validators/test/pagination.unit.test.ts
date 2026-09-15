import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  definePaginationPolicy,
  financeInstallmentsPaginationPolicy,
  financeOverduePaginationPolicy,
  studentPaginationPolicy,
} from "../src/pagination.js";

const FIRST_PAGE = 1;
const SMALL_PAGE_SIZE = 10;
const MEDIUM_PAGE_SIZE = 25;
const LARGE_PAGE_SIZE = 50;
const UNSUPPORTED_PAGE_SIZE = 20;
const FRACTIONAL_PAGE = 1.5;
const omitted: { value?: number } = {};

void describe("pagination policies", () => {
  void it("uses each route default and accepts only configured sizes", () => {
    assert.equal(studentPaginationPolicy.pageSizeSchema.parse(omitted.value), SMALL_PAGE_SIZE);
    assert.equal(
      financeInstallmentsPaginationPolicy.pageSizeSchema.parse(omitted.value),
      MEDIUM_PAGE_SIZE,
    );
    assert.equal(
      financeOverduePaginationPolicy.pageSizeSchema.parse(omitted.value),
      SMALL_PAGE_SIZE,
    );
    assert.equal(
      financeInstallmentsPaginationPolicy.pageSizeSchema.parse(LARGE_PAGE_SIZE),
      LARGE_PAGE_SIZE,
    );
    assert.equal(
      financeInstallmentsPaginationPolicy.pageSizeSchema.safeParse(UNSUPPORTED_PAGE_SIZE).success,
      false,
    );
    assert.equal(
      financeOverduePaginationPolicy.pageSizeSchema.safeParse(MEDIUM_PAGE_SIZE).success,
      false,
    );
  });

  void it("defaults the page to one and rejects invalid page numbers", () => {
    assert.equal(studentPaginationPolicy.pageSchema.parse(omitted.value), FIRST_PAGE);
    for (const page of [0, -FIRST_PAGE, FRACTIONAL_PAGE]) {
      assert.equal(studentPaginationPolicy.pageSchema.safeParse(page).success, false);
    }
  });

  void it("rejects a policy whose default is unavailable", () => {
    assert.throws(
      () =>
        definePaginationPolicy({
          pageSizeOptions: [SMALL_PAGE_SIZE, MEDIUM_PAGE_SIZE] as const,
          defaultPageSize: LARGE_PAGE_SIZE as typeof SMALL_PAGE_SIZE,
        }),
      /defaultPageSize/u,
    );
  });
});
