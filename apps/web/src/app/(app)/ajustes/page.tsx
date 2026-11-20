import type { Metadata } from "next";
import type { ReactElement } from "react";

import { SettingsHome } from "~/features/settings/settings-home";
import { requireRole } from "~/lib/require-role";

export const metadata: Metadata = { title: "Ajustes" };

export default async function AjustesRoute(): Promise<ReactElement> {
  const identity = await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return <SettingsHome systemAdmin={identity.role === "SYSTEM_ADMIN"} />;
}
