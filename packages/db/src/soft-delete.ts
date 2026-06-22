import type { JsArgs, JsInputValue, ModelQueryOptionsCbArgs } from "@prisma/client/runtime/client";

const FILTERED_READ_OPERATIONS = new Set([
  "aggregate",
  "count",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "groupBy",
]);

const UUID_ENTITY_EXCEPTIONS = new Set(["Account", "FinanceSettings", "Session", "Verification"]);

function isInputObject(value: JsInputValue): value is Record<string, JsInputValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Adds the default UUIDEntity visibility condition unless the caller supplied one. */
export function withActiveRecordFilter<Arguments extends JsArgs>(arguments_: Arguments): Arguments {
  const where = isInputObject(arguments_.where) ? arguments_.where : {};

  if (Object.hasOwn(where, "deletedAt")) {
    return arguments_;
  }

  return {
    ...arguments_,
    where: { ...where, deletedAt: null },
  };
}

function filterUuidEntityRead({
  model,
  operation,
  args,
  query,
}: ModelQueryOptionsCbArgs): Promise<unknown> {
  const isUuidEntityRead =
    model !== undefined &&
    !UUID_ENTITY_EXCEPTIONS.has(model) &&
    FILTERED_READ_OPERATIONS.has(operation);

  return query(isUuidEntityRead ? withActiveRecordFilter(args) : args);
}

export const softDeleteExtension = {
  name: "lazuli-soft-delete",
  query: {
    $allModels: {
      $allOperations: filterUuidEntityRead,
    },
  },
} as const;
