import type { Metadata } from "next";
import type { ReactElement } from "react";
import { ActivityPage } from "~/features/activity/activity-page";
import { requireRole } from "~/lib/require-role";
export const metadata: Metadata = { title: "Log de atividades" };
export default async function ActivityRoute(): Promise<ReactElement> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return <ActivityPage />;
}
