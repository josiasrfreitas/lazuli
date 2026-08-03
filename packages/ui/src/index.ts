/**
 * Shared UI components. Portuguese-BR labels live near the UI (§2.1).
 * Baseline library ships when GRE-57 (P00) closes — not in backend issues (D-0036).
 */

export const UI_PACKAGE = "@lazuli/ui" as const;

export { Badge, badgeVariants } from "./components/badge";
export type { BadgeProps, BadgeVariant } from "./components/badge";
export { Button, buttonVariants } from "./components/button";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./components/button";
export { HelloWorld } from "./components/hello-world";
export type { HelloWorldProps } from "./components/hello-world";
export { cn } from "./lib/utils";
