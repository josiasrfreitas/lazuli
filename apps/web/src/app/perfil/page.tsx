import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStaffIdentity } from "@lazuli/auth/server";
import { experienceDestination } from "~/lib/staff-experience";
import { ActivateExperience } from "./activate-experience";

/** Resolves permission on the server; only a mounted page changes the cookie. */
export default async function ProfileRoute({
  searchParams,
}: {
  searchParams: Promise<{ perfil?: string; retorno?: string }>;
}) {
  const identity = await getStaffIdentity({ headers: await headers() });
  if (!identity) redirect("/login");
  const { perfil, retorno } = await searchParams;
  const role = (identity.roles ?? [identity.role]).find((candidate) => candidate === perfil);
  if (!role) redirect("/403");
  return <ActivateExperience role={role} destination={experienceDestination(retorno, role)} />;
}
