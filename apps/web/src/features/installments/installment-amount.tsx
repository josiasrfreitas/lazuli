"use client";

import type { ReactElement } from "react";
import { BadgePercent } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@lazuli/ui";
import type { FinanceInstallmentRow } from "@lazuli/validators";
import { installmentAmountVm } from "./view-model";

export function InstallmentAmount({
  row,
  column,
}: {
  row: FinanceInstallmentRow;
  column: "nominal" | "paid";
}): ReactElement {
  const amount = installmentAmountVm(row);
  const description = column === "nominal" ? amount.condition : amount.discount;
  const formattedValue = column === "nominal" ? amount.nominal : amount.paid;
  const value = (
    <span className="font-numeric inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums">
      {formattedValue}
      {description === null ? null : (
        <BadgePercent aria-hidden="true" className="size-3.5 text-muted-foreground" />
      )}
    </span>
  );
  if (description === null) return value;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              tabIndex={0}
              aria-label={`${formattedValue}. ${description}`}
              className="inline-flex"
            >
              {value}
            </span>
          }
        />
        <TooltipContent side="top">{description}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
