import { redirect } from "next/navigation";
import { requireRole } from "~/lib/require-role";
import { formationUrl } from "~/features/class-organization/links";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<never> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  redirect(formationUrl(await searchParams));
}
