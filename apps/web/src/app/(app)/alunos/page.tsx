import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createCaller, createTRPCContext } from "@lazuli/api";
import { studentPaginationPolicy } from "@lazuli/validators";

import { StudentsPage, type InitialStudentsData } from "~/features/students/students-page";
import { requireRole } from "~/lib/require-role";

export const metadata: Metadata = { title: "Alunos" };

export default async function AlunosRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const identity = await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  if (Object.keys(await searchParams).length > 0) return <StudentsPage />;

  const caller = createCaller(
    await createTRPCContext({ session: { user: { email: identity.email } } }),
  );
  const [list, classOptions] = await Promise.all([
    caller.students
      .list({ page: 1, pageSize: studentPaginationPolicy.defaultPageSize, status: "all" })
      .then(
        (data) => ({ data, updatedAt: Date.now() }),
        (): undefined => undefined,
      ),
    caller.students.listFilterOptions({ kind: "class", search: "" }).then(
      (data) => ({ data, updatedAt: Date.now() }),
      (): undefined => undefined,
    ),
  ]);
  const initial: InitialStudentsData = {
    ...(list ? { list } : {}),
    ...(classOptions ? { classOptions } : {}),
  };
  return <StudentsPage initial={initial} />;
}
