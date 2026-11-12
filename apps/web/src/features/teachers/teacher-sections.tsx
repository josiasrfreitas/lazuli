"use client";
import type { ReactElement, ReactNode } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { LayoutDashboard, UserRound } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@lazuli/ui";
import { TeacherRegistration } from "./teacher-registration";
const SECTIONS = ["visao-geral", "cadastro"] as const;
export function TeacherSections({
  teacher,
  children,
  onEdit,
}: {
  teacher: RouterOutputs["teachers"]["byId"];
  children: ReactNode;
  onEdit: () => void;
}): ReactElement {
  const [section, setSection] = useQueryState(
    "secao",
    parseAsStringLiteral(SECTIONS).withDefault("visao-geral"),
  );
  return (
    <Tabs
      value={section}
      variant="underline"
      size="md"
      onValueChange={(value) => void setSection(value === "cadastro" ? "cadastro" : "visao-geral")}
    >
      <TabsList aria-label="Seções do professor" className="min-w-full">
        <TabsTab value="visao-geral">
          <LayoutDashboard aria-hidden="true" /> Visão geral
        </TabsTab>
        <TabsTab value="cadastro">
          <UserRound aria-hidden="true" /> Cadastro
        </TabsTab>
      </TabsList>
      <TabsPanel value="visao-geral">
        <div className="grid gap-5">{children}</div>
      </TabsPanel>
      <TabsPanel value="cadastro">
        <TeacherRegistration teacher={teacher} onEdit={onEdit} />
      </TabsPanel>
    </Tabs>
  );
}
