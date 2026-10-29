import { redirect } from "next/navigation";
import { requireRole } from "~/lib/require-role";
import { classOrganizationEnabled } from "~/lib/feature-flags";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<never> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  if (!classOrganizationEnabled) redirect("/turmas");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  params.set("secao", "organizacao");
  redirect(`/turmas?${params.toString()}`);
}
