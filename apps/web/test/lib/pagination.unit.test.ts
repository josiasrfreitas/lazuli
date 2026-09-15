import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  financeInstallmentsPaginationPolicy,
  financeOverduePaginationPolicy,
} from "@lazuli/validators";

import {
  canonicalPaginationParams,
  normalizeUrlPagination,
  pageSizeParams,
  pageSizeOptionsFor,
  pageWithinRange,
  tablePaginationPropsFor,
} from "../../src/lib/pagination.js";

const handlers = { setPage: () => {}, setPageSize: () => {} };
const FIRST_PAGE = 1;
const SECOND_PAGE = 2;
const THIRD_PAGE = 3;
const FOURTH_PAGE = 4;
const SMALL_PAGE_SIZE = 10;
const DEFAULT_PAGE_SIZE = 25;
const LARGE_PAGE_SIZE = 50;
const INVALID_PAGE_SIZE = 99;
const TOTAL_ITEMS = 76;
const OUT_OF_RANGE_PAGE = 9;
const missing: { data?: never } = {};

void describe("URL pagination", () => {
  void it("normalizes invalid values and preserves valid non-default values", () => {
    assert.deepEqual(
      normalizeUrlPagination(financeInstallmentsPaginationPolicy, {
        pageParam: "0",
        pageSizeParam: "99",
      }),
      { page: FIRST_PAGE, pageSize: DEFAULT_PAGE_SIZE },
    );
    assert.deepEqual(
      normalizeUrlPagination(financeInstallmentsPaginationPolicy, {
        pageParam: "3",
        pageSizeParam: "10",
      }),
      { page: THIRD_PAGE, pageSize: SMALL_PAGE_SIZE },
    );
  });

  void it("omits defaults and clears the page when the size changes", () => {
    assert.deepEqual(
      canonicalPaginationParams(financeInstallmentsPaginationPolicy, {
        page: FIRST_PAGE,
        pageSize: DEFAULT_PAGE_SIZE,
      }),
      { pageParam: null, pageSizeParam: null },
    );
    assert.deepEqual(pageSizeParams(financeInstallmentsPaginationPolicy, LARGE_PAGE_SIZE), {
      pageParam: null,
      pageSizeParam: "50",
    });
    assert.equal(pageSizeParams(financeInstallmentsPaginationPolicy, INVALID_PAGE_SIZE), null);
  });
});

void describe("table pagination adapter", () => {
  void it("keeps configured furniture while loading and uses loaded totals afterward", () => {
    const pagination = {
      ...handlers,
      page: SECOND_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
      pageSizeOptions: financeInstallmentsPaginationPolicy.pageSizeOptions,
    };
    const loading = tablePaginationPropsFor(pagination, missing.data);
    const loaded = tablePaginationPropsFor(pagination, {
      page: SECOND_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
      pageCount: FOURTH_PAGE,
      total: TOTAL_ITEMS,
    });

    assert.equal(loading.loading, true);
    assert.deepEqual(loading.pageSizeOptions, financeInstallmentsPaginationPolicy.pageSizeOptions);
    assert.deepEqual(loaded, {
      onPageChange: handlers.setPage,
      onPageSizeChange: handlers.setPageSize,
      page: SECOND_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
      pageSizeOptions: financeInstallmentsPaginationPolicy.pageSizeOptions,
      pageCount: FOURTH_PAGE,
      totalItems: TOTAL_ITEMS,
    });
  });

  void it("omits the selector for a fixed policy and bounds pages only when requested", () => {
    const fixed = tablePaginationPropsFor(
      { ...handlers, page: FIRST_PAGE, pageSize: SMALL_PAGE_SIZE },
      { page: FIRST_PAGE, pageSize: SMALL_PAGE_SIZE, pageCount: 0, total: 0 },
    );

    assert.equal("pageSizeOptions" in fixed, false);
    assert.equal(pageWithinRange(OUT_OF_RANGE_PAGE, THIRD_PAGE), THIRD_PAGE);
    assert.equal(pageWithinRange(OUT_OF_RANGE_PAGE, 0), FIRST_PAGE);
    assert.equal(pageSizeOptionsFor(financeOverduePaginationPolicy) === undefined, true);
  });
});
