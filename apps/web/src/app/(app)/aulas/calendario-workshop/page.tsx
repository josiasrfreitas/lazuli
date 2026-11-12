import { notFound } from "next/navigation";
import { requireRole } from "~/lib/require-role";
import { AcademicCalendarWorkshop } from "~/features/academic-calendar/workshop";

export default async function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return <AcademicCalendarWorkshop />;
}
