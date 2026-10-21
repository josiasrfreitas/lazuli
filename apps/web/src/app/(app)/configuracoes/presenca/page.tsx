import type { Metadata } from "next";
import type { ReactElement } from "react";
import { AttendanceSettingsPage } from "~/features/student-attendance/settings";
import { requireRole } from "~/lib/require-role";
export const metadata: Metadata = { title: "Área da escola para presença" };
export default async function Page(): Promise<ReactElement> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return <AttendanceSettingsPage />;
}
