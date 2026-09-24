import type { ReactElement } from "react";

import { SettingsPage } from "~/features/settings/settings-page";
import { requireRole } from "~/lib/require-role";

export default async function AjustesRoute(): Promise<ReactElement> {
  await requireRole(["SYSTEM_ADMIN"]);
  return <SettingsPage />;
}
