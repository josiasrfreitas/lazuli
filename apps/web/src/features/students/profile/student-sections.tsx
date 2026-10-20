import type { ReactElement } from "react";
import { BookOpen, Wallet } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@lazuli/ui";
import { StudentPedagogy } from "./student-pedagogy";
import { StudentFinanceSection } from "./student-finance";

const SECTIONS = ["pedagogico", "financeiro"] as const;

export function StudentSections({ id }: { id: string }): ReactElement {
  const [section, setSection] = useQueryState(
    "secao",
    parseAsStringLiteral(SECTIONS).withDefault("pedagogico"),
  );
  return (
    <Tabs
      value={section}
      variant="underline"
      size="md"
      onValueChange={(value) =>
        void setSection(value === "financeiro" ? "financeiro" : "pedagogico")
      }
    >
      <TabsList aria-label="Seções do aluno">
        <TabsTab value="pedagogico">
          <BookOpen aria-hidden="true" /> Pedagógico
        </TabsTab>
        <TabsTab value="financeiro">
          <Wallet aria-hidden="true" /> Financeiro
        </TabsTab>
      </TabsList>
      <TabsPanel value="pedagogico">
        <div className="pt-5">
          <StudentPedagogy id={id} />
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
