import { createRef } from "react";

import { Button, type ButtonSize, type ButtonVariant } from "../src/components/button.js";

const buttonRef = createRef<HTMLButtonElement>();

export const buttonWithRef = <Button ref={buttonRef}>Save</Button>;

const variants: ButtonVariant[] = ["primary", "secondary", "ghost", "destructive", "link"];
const sizes: ButtonSize[] = ["sm", "md", "lg", "icon-sm", "icon-md", "icon-lg"];

export const buttonContract = (
  <>
    {variants.map((variant) => (
      <Button key={variant} loading size="md" variant={variant}>
        Save
      </Button>
    ))}
    {sizes.map((size) => (
      <Button
        aria-label={size.startsWith("icon") ? "More options" : undefined}
        key={size}
        size={size}
      >
        Save
      </Button>
    ))}
  </>
);

// @ts-expect-error Button variants are a closed public contract.
export const invalidButtonVariant = <Button variant="outline">Invalid</Button>;
