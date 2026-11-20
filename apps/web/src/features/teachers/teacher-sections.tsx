"use client";
import { RecordTabs, RecordTabsList } from "~/components/record-tabs";
import { useEffect, useState, type ReactElement } from "react";
import dynamic from "next/dynamic";
import type { RouterOutputs } from "@lazuli/api";
import { BookOpen, LayoutDashboard, UserRound, Users } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { TabsPanel, TabsTab } from "@lazuli/ui";
import { useSectionCarousel } from "~/lib/use-section-carousel";
import { TeacherHeaderLoading } from "./teacher-loading";
import { TeacherHeader } from "./teacher-header";
import { TeacherStudentsLoading } from "./teacher-students-loading";
import { TeacherMetrics } from "./teacher-metrics";
import { TeacherRegistrationLoading, TeacherClassesPanelLoading } from "./teacher-section-loading";
import record from "~/components/record-tabs.module.css";
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
const OVERVIEW_SECTION = "visao-geral";
const SECTIONS = [OVERVIEW_SECTION, "turmas", "alunos", "cadastro"] as const;
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
    parseAsStringLiteral(SECTIONS).withDefault(OVERVIEW_SECTION),
  );
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState(section);
  useEffect(() => {
    setActiveTab(section);
  }, [section]);
  const switchSection = useSectionCarousel({ order: SECTIONS, scope: "recordCarousel" });
  const navigation = <TeacherNavigation disabled={busy || !teacher} />;
  return (
    <div className={record.person}>
      <RecordTabs
        value={activeTab}
        onValueChange={(value) => {
          const next = SECTIONS.find((item) => item === value);
          if (next && !busy) {
            setActiveTab(next);
            switchSection(section, { next, update: () => void setSection(next) });
          }
        }}
      >
        <TeacherSectionHeader {...{ teacher, onEdit, onDepart, navigation }} />
        <TabsPanel key={section} value={activeTab}>
          <div
            className={styles.sectionContent}
            data-overview={section === OVERVIEW_SECTION || undefined}
          >
            {section === OVERVIEW_SECTION && (
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
            {section === "cadastro" && (
              <TeacherRegistrationContent {...{ teacher, onEdit, setBusy }} />
            )}
          </div>
        </TabsPanel>
      </RecordTabs>
    </div>
  );
}

function TeacherNavigation({ disabled }: { disabled: boolean }): ReactElement {
  return (
    <RecordTabsList label="Seções do professor">
      <TabsTab disabled={disabled} value={OVERVIEW_SECTION}>
        <LayoutDashboard aria-hidden="true" />
        Visão geral
      </TabsTab>
      <TabsTab disabled={disabled} value="turmas">
        <BookOpen aria-hidden="true" />
        Turmas
      </TabsTab>
      <TabsTab disabled={disabled} value="alunos">
        <Users aria-hidden="true" />
        Alunos
      </TabsTab>
      <TabsTab disabled={disabled} value="cadastro">
        <UserRound aria-hidden="true" />
        Cadastro
      </TabsTab>
    </RecordTabsList>
  );
}

function TeacherRegistrationContent({
  teacher,
  onEdit,
  setBusy,
}: {
  teacher: RouterOutputs["teachers"]["byId"] | undefined;
  onEdit: () => void;
  setBusy: (busy: boolean) => void;
}): ReactElement {
  if (!teacher) return <TeacherRegistrationLoading />;
  return <TeacherRegistration teacher={teacher} onEdit={onEdit} onBusyChange={setBusy} />;
}

function TeacherSectionHeader({
  teacher,
  ...props
}: {
  teacher: RouterOutputs["teachers"]["byId"] | undefined;
  onEdit: () => void;
  onDepart: () => void;
  navigation: ReactElement;
}): ReactElement {
  if (!teacher) return <TeacherHeaderLoading navigation={props.navigation} />;
  return <TeacherHeader teacher={teacher} {...props} />;
}
