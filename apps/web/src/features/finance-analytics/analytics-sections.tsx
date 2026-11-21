import { SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import type { ReactElement } from "react";

export function AnalyticsSections({
  sections,
  active,
  setActive,
}: {
  sections: Record<string, string>;
  active: string;
  setActive: (value: string) => void;
}): ReactElement {
  return (
    <div className="max-w-full overflow-x-auto">
      <SegmentedControl
        size="sm"
        aria-label="Indicadores por assunto"
        value={active}
        onValueChange={(value) => {
          if (value) setActive(value);
        }}
      >
        {Object.entries(sections).map(([id, name]) => (
          <SegmentedControlItem key={id} value={id}>
            {name}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </div>
  );
}
