import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import { TeacherHome } from "~/features/teacher-workspace/home";
export const metadata = { title: "Meu início" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const params = await searchParams;
  if (params.dia) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") query.set(key, value);
    }
    redirect(`/professor/agenda?${query.toString()}`);
  }
  return <TeacherHome />;
}
