"use client";
import type { ReactElement } from "react";
import { BookOpen, Wallet } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@lazuli/ui";
import { useStudentProfile } from "./logic";
import { StudentHeader, StudentContact } from "./student-identity";
import { ProfileLoading, ProfileError } from "./profile-shared";
import { StudentPedagogySection } from "./student-pedagogy";
import { StudentFinanceSection } from "./student-finance";

const SECTIONS = ["pedagogico", "financeiro"] as const;
export function StudentPage({ id }: { id: string }): ReactElement {
  const profile = useStudentProfile(id);
  const [section, setSection] = useQueryState(
    "secao",
    parseAsStringLiteral(SECTIONS).withDefault("pedagogico"),
  );
  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto grid w-full max-w-7xl gap-6 p-4 sm:p-6 lg:p-8">
        {profile.isPending && <ProfileLoading />}
        {profile.isError && (
          <ProfileError message={profile.error.message} onRetry={() => void profile.refetch()} />
        )}
        {profile.data && (
          <>
            <StudentHeader profile={profile.data} />
            <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
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
                    <BookOpen aria-hidden="true" />
                    Pedagógico
                  </TabsTab>
                  <TabsTab value="financeiro">
                    <Wallet aria-hidden="true" />
                    Financeiro
                  </TabsTab>
                </TabsList>
                <TabsPanel value="pedagogico">
                  <StudentPedagogySection id={id} />
                </TabsPanel>
                <TabsPanel value="financeiro">
                  <StudentFinanceSection id={id} />
                </TabsPanel>
              </Tabs>
              <StudentContact profile={profile.data} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
