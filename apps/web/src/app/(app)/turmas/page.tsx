import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createCaller, createTRPCContext } from "@lazuli/api";

import { ClassesPage, type InitialClassesData } from "~/features/classes/classes-page";
import { classListQueryInput } from "~/features/classes/class-list-model";
import { requireRole } from "~/lib/require-role";
import { classOrganizationEnabled } from "~/lib/feature-flags";

export const metadata: Metadata = { title: "Turmas" };

export default async function TurmasRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const identity = await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  if (Object.keys(await searchParams).length > 0)
    return <ClassesPage organizationEnabled={classOrganizationEnabled} />;

  const caller = createCaller(
    await createTRPCContext({ session: { user: { email: identity.email } } }),
  );
  const [list, options] = await Promise.all([
    caller.classes
      .list(
        classListQueryInput({
          busca: "",
          tipo: null,
          formato: null,
          professor: null,
          estagio: null,
          semestre: null,
          estado: null,
          pagina: 1,
        }),
      )
      .then(
        (data) => ({ data, updatedAt: Date.now() }),
        (): undefined => undefined,
      ),
    caller.classes.formOptions().then(
      (data) => ({ data, updatedAt: Date.now() }),
      (): undefined => undefined,
    ),
  ]);
  const initial: InitialClassesData = {
    ...(list ? { list } : {}),
    ...(options ? { options } : {}),
  };
  return <ClassesPage organizationEnabled={classOrganizationEnabled} initial={initial} />;
}
