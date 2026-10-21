import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "~/lib/require-role";
export const metadata: Metadata = { title: "Próximo semestre" };
export default async function Page(): Promise<void> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  redirect("/organizacao");
}
