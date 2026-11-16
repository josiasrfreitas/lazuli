import type { ReactElement } from "react";
import { isDevelopment } from "~/lib/env";
import { notFound } from "next/navigation";
import { requireRole } from "~/lib/require-role";
import { AcademicCalendarWorkshop } from "~/features/academic-calendar/workshop";

export default async function Page(): Promise<ReactElement> {
  if (!isDevelopment) notFound();
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return <AcademicCalendarWorkshop />;
}
