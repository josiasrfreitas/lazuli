/**
 * Better Auth config, session helpers, role/session typing (§2.1).
 * Server-side wiring only (GRE-15). Login/sign-out UI → GRE-58 (P01, D-0036).
 */

export const AUTH_PACKAGE = "@lazuli/auth" as const;

export { createAuth } from "./auth.js";
export type { AuthInstance, CreateAuthInput } from "./auth.js";
export { createAuthOptions, THIRTY_DAY_SESSION_SECONDS } from "./auth-options.js";
export { createMagicLinkSender } from "./email.js";
export { getAuthEnvironment } from "./env.js";
export type { AuthEnvironment } from "./env.js";
export type { AuthOptionsInput, MagicLinkDelivery, MagicLinkSender } from "./auth-options.js";
export { evaluateStaffAccess } from "./staff-access.js";
export type {
  StaffAccessDeniedReason,
  StaffAccessResult,
  StaffAccessUser,
  StaffRole,
} from "./staff-access.js";
