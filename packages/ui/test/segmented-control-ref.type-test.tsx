import { createRef } from "react";

import { SegmentedControl, SegmentedControlItem } from "../src/components/segmented-control.js";

const groupRef = createRef<HTMLDivElement>();
const itemRef = createRef<HTMLButtonElement>();

export const segmentedWithRefs = (
  <SegmentedControl
    aria-label="Tipo do documento"
    onValueChange={() => {}}
    ref={groupRef}
    value="CPF"
  >
    <SegmentedControlItem ref={itemRef} value="CPF">
      CPF
    </SegmentedControlItem>
    <SegmentedControlItem value="RG">RG</SegmentedControlItem>
  </SegmentedControl>
);

export const segmentedContract = (
  <SegmentedControl
    aria-labelledby="document-type-label"
    disabled
    invalid
    onValueChange={(value: string | null) => value}
    size="sm"
    value={null}
  >
    <SegmentedControlItem value="CPF">CPF</SegmentedControlItem>
  </SegmentedControl>
);

export const segmentedWithArrayValue = (
  // @ts-expect-error The control is single-select: `value` is a string or null, never an array.
  <SegmentedControl onValueChange={() => {}} value={["CPF"]} />
);

// @ts-expect-error Every item needs a `value`.
export const itemWithoutValue = <SegmentedControlItem>CPF</SegmentedControlItem>;
