import { StudentPlanning } from "~/features/stage-planning/student-planning";
import type { ReactElement } from "react";
import { BookOpen, Wallet } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@lazuli/ui";
import { StudentPedagogySection } from "./student-pedagogy";
import { StudentFinanceSection } from "./student-finance";

import { useStudentProfile } from "./logic";
import { ProfileError } from "./profile-shared";
import { PedagogyLoading } from "./student-loading";

const SECTIONS = ["pedagogico", "financeiro", "planejamento"] as const;

export function StudentSections({ id }: { id: string }): ReactElement {
  const profile = useStudentProfile(id);
  const [section, setSection] = useQueryState(
    "secao",
    parseAsStringLiteral(SECTIONS).withDefault("pedagogico"),
  );
  return (
    <Tabs
      value={section}
      variant="underline"
      size="md"
      onValueChange={(value: string | null) => void setSection(studentSection(value))}
    >
      <TabsList aria-label="Seções do aluno" className="max-w-full overflow-x-auto">
        <TabsTab value="planejamento">Planejamento</TabsTab>
        <TabsTab value="pedagogico">
          <BookOpen aria-hidden="true" /> Pedagógico
        </TabsTab>
        <TabsTab value="financeiro">
          <Wallet aria-hidden="true" /> Financeiro
        </TabsTab>
      </TabsList>
      <TabsPanel value="planejamento">
        <StudentPlanning studentId={id} />
      </TabsPanel>
      <TabsPanel value="pedagogico">
        <div className="pt-5">
          {profile.isPending && <PedagogyLoading />}
          {profile.isError && (
            <ProfileError message={profile.error.message} onRetry={() => void profile.refetch()} />
          )}
          {profile.data && <StudentPedagogySection profile={profile.data} />}
        </div>
      </TabsPanel>
      <TabsPanel value="financeiro">
        <div className="pt-5">
          <StudentFinanceSection id={id} />
        </div>
      </TabsPanel>
    </Tabs>
  );
}

function studentSection(value: string | null): (typeof SECTIONS)[number] {
  return SECTIONS.find((section) => section === value) ?? "pedagogico";
}
