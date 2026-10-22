"use client";
import { useState, type ReactElement } from "react";
import { CalendarDays, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button, Tabs, TabsList, TabsTab, TabsPanel } from "@lazuli/ui";
import { useWorkshop, type WorkshopView } from "./controller";
import { DeskRecords } from "./profile-proposals";
import { NewRecord, EmptyState } from "./proposal-shared";
import { ActionDialog } from "./workshop-chrome";
import {
  AppointmentPreview,
  scenarioAppointments,
  type AppointmentScenario,
  type PreviewAppointment,
} from "./appointment-preview";
import { AppointmentSchedulePreview } from "./appointment-schedule-preview";
import proposalStyles from "./profile-proposals.module.css";
import styles from "./layout-workshop.module.css";

export type LayoutDirection = "strip" | "panel" | "tabs";
export const LAYOUTS = [
  {
    id: "strip",
    label: "Agenda em carrossel",
    description:
      "Datas e motivos em uma faixa horizontal. A mesa ocupa toda a largura logo abaixo.",
    tradeoff:
      "Com poucos atendimentos, as células mantêm sua largura; sem nenhum, a agenda fica oculta.",
  },
  {
    id: "panel",
    label: "Painel recolhível",
    description:
      "A mesa conduz o trabalho. Abra os atendimentos ao lado somente quando precisar cruzar as informações.",
    tradeoff: "Permite consultar os dois juntos; com o painel aberto, a mesa fica mais estreita.",
  },
  {
    id: "tabs",
    label: "Espaço com abas",
    description:
      "Atendimentos e acompanhamento compartilham a mesma área, cada um usando toda a largura.",
    tradeoff: "Mais espaço para cada tarefa; comparar agenda e intervenção exige alternar a aba.",
  },
] as const;

type LayoutProps = { direction: LayoutDirection; scenario: AppointmentScenario; studentId: string };
export function LayoutWorkshop({ direction, scenario, studentId }: LayoutProps): ReactElement {
  const vm = useWorkshop();
  const [creating, setCreating] = useState(false);
  const [added, setAdded] = useState<Partial<Record<AppointmentScenario, PreviewAppointment[]>>>(
    {},
  );
  const rows = [...scenarioAppointments(scenario), ...(added[scenario] ?? [])];
  const option = LAYOUTS.find((item) => item.id === direction)!;
  const appointments = <AppointmentPreview rows={rows} studentId={studentId} />;
  const desk = <DeskWorkspace vm={vm} onSchedule={() => setCreating(true)} />;
  const layout = { appointments, desk, count: rows.length, activeCount: vm.activeCount };
  return (
    <section
      className={styles.workspace}
      aria-label="Workshop de disposição do acompanhamento"
      data-layout={direction}
    >
      <DirectionNote option={option} />
      <WorkspaceComposition
        direction={direction}
        layout={layout}
        rows={rows}
        studentId={studentId}
      />
      <p role="status" className={styles.notice}>
        {vm.notice}
      </p>
      <ActionDialog vm={vm} />
      {creating && (
        <AppointmentSchedulePreview
          onClose={() => setCreating(false)}
          onSave={(row) => {
            setAdded((current) => ({
              ...current,
              [scenario]: [...(current[scenario] ?? []), row],
            }));
            setCreating(false);
            vm.setNotice("Atendimento adicionado à simulação.");
          }}
        />
      )}
    </section>
  );
}

type CompositionProps = {
  appointments: ReactElement;
  desk: ReactElement;
  count: number;
  activeCount: number;
};
function PanelLayout({ appointments, desk, count }: CompositionProps): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={styles.panelToolbar}>
        <p>Consulte os atendimentos junto ao registro em acompanhamento.</p>
        <Button
          size="sm"
          variant="secondary"
          aria-expanded={open}
          aria-controls="workshop-appointments-panel"
          onClick={() => setOpen(!open)}
        >
          {open ? <PanelRightClose aria-hidden="true" /> : <PanelRightOpen aria-hidden="true" />}
          {open ? "Recolher atendimentos" : `Atendimentos (${count})`}
        </Button>
      </div>
      <div className={styles.panelLayout} data-open={open}>
        {desk}
        {open && <aside id="workshop-appointments-panel">{appointments}</aside>}
      </div>
    </>
  );
}
function TabbedLayout({ appointments, desk, count, activeCount }: CompositionProps): ReactElement {
  const [tab, setTab] = useState("followup");
  return (
    <Tabs value={tab} onValueChange={setTab} variant="underline">
      <TabsList aria-label="Acompanhamento e atendimentos">
        <TabsTab value="followup">Acompanhamento · {activeCount} em aberto</TabsTab>
        <TabsTab value="appointments">
          <CalendarDays aria-hidden="true" />
          Atendimentos · {count}
        </TabsTab>
      </TabsList>
      <TabsPanel value="followup">{desk}</TabsPanel>
      <TabsPanel value="appointments">{appointments}</TabsPanel>
    </Tabs>
  );
}
function DeskWorkspace({
  vm,
  onSchedule,
}: {
  vm: WorkshopView;
  onSchedule: () => void;
}): ReactElement {
  return (
    <section
      className={`${proposalStyles.proposal} ${proposalStyles.embedded}`}
      aria-label="Mesa de acompanhamento"
    >
      <header className={styles.deskHeading}>
        <div>
          <h2>Acompanhamento pedagógico</h2>
          <p>
            {vm.activeCount} intervenções em aberto · {vm.state.occurrences.length} ocorrências
          </p>
        </div>
        <div className={styles.deskActions}>
          <Button size="sm" variant="secondary" onClick={onSchedule}>
            <CalendarDays aria-hidden="true" />
            Agendar atendimento
          </Button>
          <NewRecord vm={vm} primary />
        </div>
      </header>
      {vm.state.cases.length + vm.state.occurrences.length === 0 ? (
        <EmptyState vm={vm} />
      ) : (
        <DeskRecords vm={vm} />
      )}
    </section>
  );
}

function DirectionNote({ option }: { option: (typeof LAYOUTS)[number] }): ReactElement {
  return (
    <div className={styles.directionNote}>
      <strong>{option.label}</strong>
      <p>
        {option.description} <span>{option.tradeoff}</span>
      </p>
    </div>
  );
}

function WorkspaceComposition({
  direction,
  layout,
  rows,
  studentId,
}: {
  direction: LayoutDirection;
  layout: CompositionProps;
  rows: PreviewAppointment[];
  studentId: string;
}): ReactElement {
  if (rows.length === 0) return layout.desk;
  if (direction === "panel") return <PanelLayout {...layout} />;
  if (direction === "tabs") return <TabbedLayout {...layout} />;
  return (
    <>
      <AppointmentPreview rows={rows} studentId={studentId} compact />
      {layout.desk}
    </>
  );
}
