import { createRef } from "react";

import { Label } from "../src/components/label.js";

const labelRef = createRef<HTMLLabelElement>();

export const labelWithRef = <Label ref={labelRef}>Email institucional</Label>;

export const labelContract = (
  <>
    <Label htmlFor="student-email">Email institucional</Label>
    <Label className="text-caption">Telefone</Label>
  </>
);

// @ts-expect-error Label renders a native label; `htmlFor` is a string.
export const labelWithInvalidHtmlFor = <Label htmlFor={12}>Email</Label>;
