"use client";
import type { ReactElement } from "react";
import { BookOpen, Wallet } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@lazuli/ui";
import { useStudentProfile, type StudentProfile } from "./logic";
import { StudentHeader } from "./student-identity";
import { ProfileLoading, ProfileError } from "./profile-shared";
import { StudentPedagogySection } from "./student-pedagogy";
import { StudentFinanceSection } from "./student-finance";

const SECTIONS = ["pedagogico", "financeiro"] as const;
export function StudentPage({ id }: { id: string }): ReactElement {
  const profile = useStudentProfile(id);
  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="grid w-full min-w-0 gap-5 px-4 py-5 sm:px-6 lg:px-8">
        {profile.isPending && <ProfileLoading />}
        {profile.isError && (
          <ProfileError message={profile.error.message} onRetry={() => void profile.refetch()} />
        )}
        {profile.data && <StudentSections profile={profile.data} />}
      </div>
    </div>
  );
}

function StudentSections({ profile }: { profile: StudentProfile }): ReactElement {
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
      <StudentHeader
        profile={profile}
        navigation={
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
        }
      />
      <TabsPanel value="pedagogico">
        <StudentPedagogySection profile={profile} />
      </TabsPanel>
      <TabsPanel value="financeiro">
        <StudentFinanceSection profile={profile} />
      </TabsPanel>
    </Tabs>
  );
}
