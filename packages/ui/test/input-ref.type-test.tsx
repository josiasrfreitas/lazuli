import { createRef } from "react";

import { Input } from "../src/components/input.js";

const inputRef = createRef<HTMLInputElement>();

export const inputWithRef = <Input ref={inputRef} type="email" />;

export const inputContract = (
  <>
    <Input aria-describedby="student-name-hint" placeholder="Full name" />
    <Input defaultValue="ana@example.com" invalid type="email" />
    <Input disabled type="search" value="Ana" readOnly />
  </>
);

// @ts-expect-error Input invalid state is boolean.
export const invalidInputState = <Input invalid="error" />;
