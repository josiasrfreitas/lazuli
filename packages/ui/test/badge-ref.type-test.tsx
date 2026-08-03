import { createRef } from "react";

import { Badge, type BadgeVariant } from "../src/components/badge.js";

const badgeRef = createRef<HTMLSpanElement>();
const variants: BadgeVariant[] = ["neutral", "success", "warning", "destructive", "info"];

export const badgeWithRef = <Badge ref={badgeRef}>Ativo</Badge>;

export const badgeContract = variants.map((variant) => (
  <Badge key={variant} variant={variant}>
    Situação
  </Badge>
));

// @ts-expect-error Badge variants are a closed public contract.
export const invalidBadgeVariant = <Badge variant="brand">Inválido</Badge>;
