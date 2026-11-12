"use client";
import { useEffect, useState, type ReactElement } from "react";
import dynamic from "next/dynamic";
import type { RouterOutputs } from "@lazuli/api";
import { BookOpen, LayoutDashboard, UserRound, Users } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@lazuli/ui";
import { useSectionCarousel } from "~/lib/use-section-carousel";
import { TeacherHeaderLoading } from "./teacher-loading";
import { TeacherHeader } from "./teacher-header";
import { TeacherStudentsLoading } from "./teacher-students-loading";
import { TeacherMetrics } from "./teacher-metrics";
import { TeacherRegistrationLoading, TeacherClassesPanelLoading } from "./teacher-section-loading";
import profile from "../students/profile/student-profile.module.css";
import styles from "./teacher-overview.module.css";

const TeacherRegistration = dynamic(
  () => import("./teacher-registration").then((module) => module.TeacherRegistration),
  { loading: TeacherRegistrationLoading },
);
const TeacherClassesPanel = dynamic(
  () => import("./teacher-classes-panel").then((module) => module.TeacherClassesPanel),
  { loading: TeacherClassesPanelLoading },
);
const TeacherStudents = dynamic(
  () => import("./teacher-students").then((module) => module.TeacherStudents),
  { loading: TeacherStudentsLoading },
);
const SECTIONS = ["visao-geral", "turmas", "alunos", "cadastro"] as const;
export function TeacherSections({
  id,
  teacher,
  onEdit,
  onDepart,
  back,
}: {
  id: string;
  teacher: RouterOutputs["teachers"]["byId"] | undefined;
  onEdit: () => void;
  onDepart: () => void;
  back: string;
}): ReactElement {
  const [section, setSection] = useQueryState(
    "secao",
    parseAsStringLiteral(SECTIONS).withDefault("visao-geral"),
  );
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState(section);
  useEffect(() => {
    setActiveTab(section);
  }, [section]);
  const switchSection = useSectionCarousel({ order: SECTIONS, scope: "studentCarousel" });
  const navigation = (
    <TabsList aria-label="Seções do professor">
      <TabsTab disabled={busy || !teacher} value="visao-geral">
        <LayoutDashboard aria-hidden="true" />
        Visão geral
      </TabsTab>
      <TabsTab disabled={busy || !teacher} value="turmas">
        <BookOpen aria-hidden="true" />
        Turmas
      </TabsTab>
      <TabsTab disabled={busy || !teacher} value="alunos">
        <Users aria-hidden="true" />
        Alunos
      </TabsTab>
      <TabsTab disabled={busy || !teacher} value="cadastro">
        <UserRound aria-hidden="true" />
        Cadastro
      </TabsTab>
    </TabsList>
  );
  return (
    <div className={profile.sections}>
      <Tabs
        value={activeTab}
        variant="underline"
        size="sm"
        onValueChange={(value) => {
          const next = SECTIONS.find((item) => item === value);
          if (next && !busy) {
            setActiveTab(next);
            switchSection(section, { next, update: () => void setSection(next) });
          }
        }}
      >
        {teacher ? (
          <TeacherHeader
            teacher={teacher}
            onEdit={onEdit}
            onDepart={onDepart}
            navigation={navigation}
          />
        ) : (
          <TeacherHeaderLoading navigation={navigation} />
        )}
        <TabsPanel key={section} value={activeTab}>
          <div
            className={styles.sectionContent}
            data-overview={section === "visao-geral" || undefined}
          >
            {section === "visao-geral" && (
              <TeacherMetrics
                id={id}
                onStudents={() => {
                  setActiveTab("alunos");
                  switchSection(section, {
                    next: "alunos",
                    update: () => void setSection("alunos"),
                  });
                }}
              />
            )}
            {section === "alunos" && <TeacherStudents id={id} />}
            {section === "turmas" && <TeacherClassesPanel id={id} back={back} />}
            {section === "cadastro" &&
              (teacher ? (
                <TeacherRegistration teacher={teacher} onEdit={onEdit} onBusyChange={setBusy} />
              ) : (
                <TeacherRegistrationLoading />
              ))}
          </div>
        </TabsPanel>
      </Tabs>
    </div>
  );
}
