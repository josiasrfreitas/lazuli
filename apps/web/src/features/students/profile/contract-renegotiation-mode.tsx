import type { ReactElement } from "react";
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
    <fieldset disabled={disabled} className="mb-3">
      <SegmentedControl
        size="sm"
        aria-label="Como renegociar o contrato"
        value={value}
        onValueChange={(next) => {
          if (next === "reduce" || next === "terminate") onChange(next);
        }}
      >
        <SegmentedControlItem value="reduce">Reduzir mensalidade</SegmentedControlItem>
        <SegmentedControlItem value="terminate">Rescindir contrato</SegmentedControlItem>
      </SegmentedControl>
    </fieldset>
  );
}
