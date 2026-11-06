import type { ReactElement } from "react";
import { FileX2, TrendingDown } from "lucide-react";
import { SegmentedControl, SegmentedControlItem } from "@lazuli/ui";

export function ContractRenegotiationMode({
  value,
  onChange,
  disabled = false,
}: {
  value: "reduce" | "terminate";
  onChange: (value: "reduce" | "terminate") => void;
  disabled?: boolean;
}): ReactElement {
  return (
    <fieldset disabled={disabled}>
      <SegmentedControl
        size="sm"
        aria-label="Como renegociar o contrato"
        value={value}
        onValueChange={(next) => {
          if (next === "reduce" || next === "terminate") onChange(next);
        }}
      >
        <SegmentedControlItem value="reduce" className="gap-1.5">
          <TrendingDown aria-hidden="true" className="size-4 shrink-0" /> Reduzir mensalidade
        </SegmentedControlItem>
        <SegmentedControlItem value="terminate" className="gap-1.5">
          <FileX2 aria-hidden="true" className="size-4 shrink-0" /> Rescindir contrato
        </SegmentedControlItem>
      </SegmentedControl>
    </fieldset>
  );
}
