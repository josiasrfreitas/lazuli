import { z, type ZodType, type ZodTypeDef } from "zod";

const SMALL_PAGE_SIZE = 10;
const MEDIUM_PAGE_SIZE = 25;
const LARGE_PAGE_SIZE = 50;
export const STANDARD_PAGE_SIZE_OPTIONS = [
  SMALL_PAGE_SIZE,
  MEDIUM_PAGE_SIZE,
  LARGE_PAGE_SIZE,
] as const;
const FIRST_PAGE = 1;
const FIXED_PAGE_SIZE = STANDARD_PAGE_SIZE_OPTIONS[0];

type PaginationResultFields = {
  page: z.ZodNumber;
  pageSize: ZodType<number>;
  pageCount: z.ZodNumber;
  total: z.ZodNumber;
};

export type PaginationPolicy<Options extends readonly [number, ...number[]]> = {
  pageSizeOptions: Options;
  defaultPageSize: Options[number];
  pageSchema: ZodType<number, ZodTypeDef, number | undefined>;
  pageSizeSchema: ZodType<Options[number], ZodTypeDef, number | undefined>;
};

export function definePaginationPolicy<
  const Options extends readonly [number, ...number[]],
>(input: {
  pageSizeOptions: Options;
  defaultPageSize: Options[number];
}): PaginationPolicy<Options> {
  if (!input.pageSizeOptions.includes(input.defaultPageSize)) {
    throw new Error("defaultPageSize must be one of pageSizeOptions");
  }

  const pageSchema = z.number().int().min(FIRST_PAGE).default(FIRST_PAGE);
  const pageSizeSchema = z
    .number()
    .int()
    .refine((value) => input.pageSizeOptions.includes(value), "Unsupported page size")
    .default(input.defaultPageSize) as ZodType<Options[number], ZodTypeDef, number | undefined>;

  return { ...input, pageSchema, pageSizeSchema };
}

export function paginationResultFields(
  policy: PaginationPolicy<readonly [number, ...number[]]>,
): PaginationResultFields {
  return {
    page: z.number().int().positive(),
    pageSize: z
      .number()
      .int()
      .refine((value) => policy.pageSizeOptions.includes(value), "Unsupported page size"),
    pageCount: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  };
}

export const studentPaginationPolicy = definePaginationPolicy({
  pageSizeOptions: STANDARD_PAGE_SIZE_OPTIONS,
  defaultPageSize: 10,
});

export const financeInstallmentsPaginationPolicy = definePaginationPolicy({
  pageSizeOptions: STANDARD_PAGE_SIZE_OPTIONS,
  defaultPageSize: 25,
});

export const financeOverduePaginationPolicy = definePaginationPolicy({
  pageSizeOptions: [FIXED_PAGE_SIZE] as const,
  defaultPageSize: FIXED_PAGE_SIZE,
});
