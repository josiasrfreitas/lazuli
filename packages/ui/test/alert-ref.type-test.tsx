import { createRef } from "react";

import {
  Alert,
  AlertAction,
  AlertContent,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  type AlertVariant,
} from "../src/components/alert.js";

const alertRef = createRef<HTMLDivElement>();
const variants: AlertVariant[] = ["neutral", "info", "success", "warning", "destructive"];

export const alertWithRef = <Alert ref={alertRef} role="status" />;

export const alertContract = variants.map((variant) => (
  <Alert key={variant} variant={variant}>
    <AlertIcon>!</AlertIcon>
    <AlertContent>
      <AlertTitle>Update available</AlertTitle>
      <AlertDescription>Review the changes before continuing.</AlertDescription>
    </AlertContent>
    <AlertAction>
      <a href="/updates">Review</a>
    </AlertAction>
  </Alert>
));

// @ts-expect-error Alert variants are a closed public contract.
export const invalidAlertVariant = <Alert variant="brand">Invalid</Alert>;
