import { requireRole } from "~/lib/require-role";
import { AttendanceSettingsPage } from "~/features/student-attendance/settings";
export default async function Page() {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return <AttendanceSettingsPage />;
}
