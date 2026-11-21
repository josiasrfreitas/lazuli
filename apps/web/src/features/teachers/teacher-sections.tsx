"use client";

import { useEffect, useState, type ReactElement } from "react";
import dynamic from "next/dynamic";
import { BookOpen, LayoutDashboard, UserRound, Users } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import type { RouterOutputs } from "@lazuli/api";
import { TabsPanel, TabsTab } from "@lazuli/ui";
import { RecordTabs, RecordTabsList } from "~/components/record-tabs";
import frame from "~/components/record-tabs.module.css";
import { useSectionCarousel } from "~/lib/use-section-carousel";
import { TeacherHeader } from "./teacher-header";
import { TeacherHeaderLoading } from "./teacher-loading";
import { TeacherMetrics } from "./teacher-metrics";
import { TeacherClassesPanelLoading, TeacherRegistrationLoading } from "./teacher-section-loading";
import { TeacherStudentsLoading } from "./teacher-students-loading";
import styles from "./teacher-overview.module.css";

const TeacherClassesPanel = dynamic(
  () => import("./teacher-classes-panel").then((module) => module.TeacherClassesPanel),
  { loading: TeacherClassesPanelLoading },
);
const TeacherStudents = dynamic(
  () => import("./teacher-students").then((module) => module.TeacherStudents),
  { loading: TeacherStudentsLoading },
);
const TeacherRegistration = dynamic(
  () => import("./teacher-registration").then((module) => module.TeacherRegistration),
  { loading: TeacherRegistrationLoading },
);

const SECTIONS = ["visao-geral", "turmas", "alunos", "cadastro"] as const;
type TeacherSection = (typeof SECTIONS)[number];

const sectionQuery = parseAsStringLiteral(SECTIONS).withDefault("visao-geral");

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
  const [section, setSection] = useQueryState("secao", sectionQuery);
  const [busy, setBusy] = useState(false);
  const switchSection = useSectionCarousel({ order: SECTIONS, scope: "recordCarousel" });

  useEffect(() => {
    // Bookmarks from the single-page record used fragments for the same sections.
    function migrateFragment(): void {
      const legacy = SECTIONS.find((value) => `#${value}` === window.location.hash);
      if (!legacy) return;
      const url = new URL(window.location.href);
      url.hash = "";
      window.history.replaceState(window.history.state, "", url);
      void setSection(legacy);
    }
    migrateFragment();
    window.addEventListener("hashchange", migrateFragment);
    return () => window.removeEventListener("hashchange", migrateFragment);
  }, [setSection]);

  function navigate(next: TeacherSection): void {
    if (busy) return;
    switchSection(section, { next, update: () => void setSection(next, { history: "push" }) });
  }

  const navigation = (
    <RecordTabsList label="Seções do docente">
      <TabsTab value="visao-geral" disabled={busy}>
        <LayoutDashboard aria-hidden="true" /> Visão geral
      </TabsTab>
      <TabsTab value="turmas" disabled={busy}>
        <BookOpen aria-hidden="true" /> Turmas
      </TabsTab>
      <TabsTab value="alunos" disabled={busy}>
        <Users aria-hidden="true" /> Alunos
      </TabsTab>
      <TabsTab value="cadastro" disabled={busy}>
        <UserRound aria-hidden="true" /> Cadastro
      </TabsTab>
    </RecordTabsList>
  );

  return (
    <div className={frame.person}>
      <RecordTabs
        value={section}
        onValueChange={(value) => {
          const next = SECTIONS.find((item) => item === value);
          if (next) navigate(next);
        }}
      >
        {teacher ? (
          <TeacherHeader {...{ teacher, onEdit, onDepart, navigation }} />
        ) : (
          <TeacherHeaderLoading navigation={navigation} />
        )}
        <TabsPanel key={section} value={section}>
          <div
            className={styles.sectionContent}
            data-overview={section === "visao-geral" || undefined}
          >
            {section === "visao-geral" && (
              <TeacherMetrics id={id} onStudents={() => navigate("alunos")} />
            )}
            {section === "turmas" && <TeacherClassesPanel id={id} back={back} />}
            {section === "alunos" && <TeacherStudents id={id} />}
            {section === "cadastro" &&
              (teacher ? (
                <TeacherRegistration teacher={teacher} onEdit={onEdit} onBusyChange={setBusy} />
              ) : (
                <TeacherRegistrationLoading />
              ))}
          </div>
        </TabsPanel>
      </RecordTabs>
    </div>
  );
}
