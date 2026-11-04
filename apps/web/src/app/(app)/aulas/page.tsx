import type { JSX as ReactJSX } from "react";
import type { Metadata } from "next";
import { createCaller, createTRPCContext } from "@lazuli/api";
import { ClassAgenda, type InitialAgendaData } from "~/features/class-records/agenda";
import { monday, schoolToday, shiftDate } from "~/features/class-records/calendar-model";
import { requireRole } from "~/lib/require-role";
export const metadata: Metadata = { title: "Agenda" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactJSX.Element> {
  const identity = await requireRole(["ADMIN", "SYSTEM_ADMIN", "TEACHER"]);
  const teacherView = identity.role === "TEACHER";
  const admin = identity.role === "ADMIN" || identity.role === "SYSTEM_ADMIN";
  if (Object.keys(await searchParams).length > 0)
    return <ClassAgenda teacherView={teacherView} admin={admin} />;

  const today = schoolToday();
  const from = monday(today);
  const to = shiftDate(from, 6);
  const caller = createCaller(
    await createTRPCContext({ session: { user: { email: identity.email } } }),
  );
  const [lessons, appointments, experiments] = await Promise.all([
    caller.classRecords.list({ from, to }).then(
      (data) => ({ data, updatedAt: Date.now() }),
      (): undefined => undefined,
    ),
    caller.appointments.list({ from, through: to }).then(
      (data) => ({ data, updatedAt: Date.now() }),
      (): undefined => undefined,
    ),
    caller.classRecords.experimentalSessions({ from, to }).then(
      (data) => ({ data, updatedAt: Date.now() }),
      (): undefined => undefined,
    ),
  ]);
  const initial: InitialAgendaData = {
    today,
    ...(lessons ? { lessons } : {}),
    ...(appointments ? { appointments } : {}),
    ...(experiments ? { experiments } : {}),
  };
  return <ClassAgenda teacherView={teacherView} admin={admin} initial={initial} />;
}
