import type { Context, RouterName, StaffUser } from "@lazuli/api";

/** The eleven routers governed by the §5.2 RBAC matrix (§5.1 router organization). */
export const ALL_ROUTERS: readonly RouterName[] = [
  "users",
  "students",
  "catalog",
  "classes",
  "calendar",
  "enrollment",
  "attendance",
  "portal",
  "finance",
  "reports",
  "dashboard",
];

export const ADMIN_FIXTURE: StaffUser = {
  id: "00000000-0000-0000-0000-0000000000ad",
  name: "Admin de Teste",
  email: "admin@example.com",
  role: "ADMIN",
  isEnabled: true,
};

export const TEACHER_FIXTURE: StaffUser = {
  id: "00000000-0000-0000-0000-0000000000ed",
  name: "Professora de Teste",
  email: "teacher@example.com",
  role: "TEACHER",
  isEnabled: true,
};

/** RBAC gating never touches the database, so a typed empty stand-in is enough. */
export function contextFor(staffUser: StaffUser | null): Context {
  return { db: {} as Context["db"], staffUser };
}
