"use client";

import { useEffect, useState, type ReactElement } from "react";
import {
  ArrowRight,
  CalendarDays,
  CalendarOff,
  CalendarRange,
  Flag,
  Palmtree,
  Pencil,
  Plus,
  Wrench,
} from "lucide-react";
import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  EmptyState,
  Tabs,
  TabsList,
  TabsTab,
  TabsPanel,
} from "@lazuli/ui";
import { CalendarChangeForm } from "./change-form";
import { CalendarHolidays } from "./holidays";
import { civilDate, shortDate } from "./date-model";
import type { AcademicYear } from "./model";
import { useManagementStep } from "./use-management-step";
import styles from "./management.module.css";

export type CalendarEditor =
  | { kind: "period" | "interruption"; id?: string }
  | { kind: "holidays" };
const kinds = { HOLIDAY: "Feriado", RECESS: "Recesso", MAINTENANCE: "Manutenção", OTHER: "Outro" };
const kindIcons = { HOLIDAY: Flag, RECESS: Palmtree, MAINTENANCE: Wrench, OTHER: CalendarOff };
export function CalendarManagement({
  data,
  year,
  section,
  onSectionChange,
  onClose,
}: {
  data: AcademicYear;
  year: number;
  section: string;
  onSectionChange: (section: string) => void;
  onClose: () => void;
}): ReactElement {
  const steps = useManagementStep<CalendarEditor | null>(null);
  const editor = steps.step;
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const element = steps.container.current;
      if (!element) return;
      const target = element.querySelector<HTMLElement>(
        editor
          ? 'input:not(:disabled), textarea:not(:disabled), [role="combobox"]'
          : '[role="tab"][aria-selected="true"]',
      );
      void Promise.all(
        element.getAnimations().map((animation) => animation.finished.catch(() => {})),
      ).then(() => {
        if (target?.isConnected) target.focus({ preventScroll: true });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [editor, steps.container]);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className={styles.dialog}
          showCloseButton={!pending}
          finalFocus={() =>
            document.querySelector<HTMLElement>("[data-calendar-configure-trigger]")
          }
        >
          <div
            ref={steps.container}
            className={styles.stage}
            onPointerDownCapture={steps.onPointerDown}
            onKeyDownCapture={steps.onKeyDown}
          >
            {editor ? (
              <ManagementEditor
                key={`${editor.kind}:${"id" in editor ? (editor.id ?? "new") : "new"}`}
                editor={editor}
                data={data}
                year={year}
                onBack={() => steps.setStep(null)}
                onPendingChange={setPending}
              />
            ) : (
              <Tabs
                className={styles.workspace}
                value={section === "semestres" ? "periods" : "interruptions"}
                onValueChange={(value) =>
                  onSectionChange(value === "periods" ? "semestres" : "interrupcoes")
                }
                variant="underline"
              >
                <ManagementHeader section={section} setEditor={steps.setStep} />
                <DialogBody className={styles.listBody}>
                  <PeriodSettings periods={data.periods} setEditor={steps.setStep} />
                  <InterruptionSettings data={data} setEditor={steps.setStep} />
                </DialogBody>
              </Tabs>
            )}
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function ManagementEditor({
  editor,
  data,
  year,
  onBack,
  onPendingChange,
}: {
  editor: CalendarEditor;
  data: AcademicYear;
  year: number;
  onBack: () => void;
  onPendingChange: (pending: boolean) => void;
}): ReactElement {
  if (editor.kind === "holidays")
    return (
      <CalendarHolidays
        embedded
        year={year}
        data={data}
        onBack={onBack}
        onClose={onBack}
        onPendingChange={onPendingChange}
      />
    );
  return (
    <CalendarChangeForm
      embedded
      mode={editor.kind}
      item={
        editor.kind === "period"
          ? data.periods.find((row) => row.id === editor.id)
          : data.interruptions.find((row) => row.id === editor.id)
      }
      onBack={onBack}
      onClose={onBack}
      onPendingChange={onPendingChange}
    />
  );
}

function ManagementHeader({
  section,
  setEditor,
}: {
  section: string;
  setEditor: (value: CalendarEditor) => void;
}): ReactElement {
  const periods = section === "semestres";
  return (
    <DialogHeader className={styles.header}>
      <div className={styles.sectionHeader}>
        <DialogTitle size="lg">
          {periods ? "Limites dos semestres" : "Dias sem atividades acadêmicas"}
        </DialogTitle>
        <DialogDescription>
          {periods
            ? "As turmas usam estas datas para organizar suas aulas regulares."
            : "Feriados e recessos suspendem aulas, atendimentos e experimentais."}
        </DialogDescription>
      </div>
      <div className={styles.headerControls}>
        <TabsList aria-label="Configuração do calendário">
          <TabsTab value="periods">
            <CalendarRange aria-hidden="true" /> Semestres
          </TabsTab>
          <TabsTab value="interruptions">
            <Flag aria-hidden="true" /> Feriados e recessos
          </TabsTab>
        </TabsList>
        <div className={styles.actions}>
          {!periods && (
            <Button size="sm" variant="secondary" onClick={() => setEditor({ kind: "holidays" })}>
              <CalendarDays aria-hidden="true" /> Buscar feriados
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setEditor({ kind: periods ? "period" : "interruption" })}
          >
            <Plus aria-hidden="true" /> {periods ? "Novo semestre" : "Adicionar intervalo"}
          </Button>
        </div>
      </div>
    </DialogHeader>
  );
}

function PeriodSettings({
  periods,
  setEditor,
}: {
  periods: AcademicYear["periods"];
  setEditor: (value: CalendarEditor) => void;
}): ReactElement {
  return (
    <TabsPanel value="periods" render={<div className={styles.section} />}>
      <PeriodList periods={periods} setEditor={setEditor} />
      <div className={styles.explanation}>
        <h3>O que muda ao ajustar um semestre</h3>
        <p>
          Você confere as aulas afetadas e a carga disponível das turmas antes de aplicar.
          Atividades já realizadas são preservadas; o calendário não altera os contratos.
        </p>
      </div>
    </TabsPanel>
  );
}

function InterruptionSettings({
  data,
  setEditor,
}: {
  data: AcademicYear;
  setEditor: (value: CalendarEditor) => void;
}): ReactElement {
  if (data.interruptions.length === 0) {
    return (
      <TabsPanel value="interruptions" render={<div className={styles.emptySection} />}>
        <EmptyState
          className={styles.empty}
          icon={<Palmtree aria-hidden="true" />}
          title="Até as pausas estão de folga"
          description="Nenhum feriado ou recesso cadastrado neste ano. Busque as sugestões ou adicione as datas da escola."
        />
      </TabsPanel>
    );
  }
  return (
    <TabsPanel value="interruptions" render={<div className={styles.section} />}>
      <ul className={styles.interruptions}>
        {data.interruptions.map((row) => {
          const KindIcon = kindIcons[row.kind];
          return (
            <li key={row.id} className={styles.interruption}>
              <div className={styles.interruptionHeader}>
                <span className={styles.interruptionDate}>
                  <CalendarDays aria-hidden="true" />
                  {shortDate(civilDate(row.fromDate))}
                  {row.fromDate.getTime() !== row.throughDate.getTime() && (
                    <small>até {shortDate(civilDate(row.throughDate))}</small>
                  )}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Editar ${row.title}`}
                  title={`Editar ${row.title}`}
                  onClick={() => setEditor({ kind: "interruption", id: row.id })}
                >
                  <Pencil aria-hidden="true" />
                </Button>
              </div>
              <div>
                <h3>{row.title}</h3>
                <p className={styles.interruptionKind}>
                  <KindIcon aria-hidden="true" /> {kinds[row.kind]} · sem atividades acadêmicas
                </p>
                {row.description && <p className={styles.description}>{row.description}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      <div className={styles.explanation}>
        <h3>Eventos e pausas têm efeitos diferentes</h3>
        <p>
          Um evento apenas informa uma data. Para suspender atividades, registre um feriado ou
          recesso. Ao remover uma pausa, aulas canceladas precisam ser reagendadas.
        </p>
      </div>
    </TabsPanel>
  );
}

function PeriodList({
  periods,
  setEditor,
}: {
  periods: AcademicYear["periods"];
  setEditor: (value: CalendarEditor) => void;
}): ReactElement {
  return periods.length > 0 ? (
    <ul className={styles.periods}>
      {periods.map((period) => (
        <li key={period.id} className={styles.period}>
          <div className={styles.periodHeading}>
            <CalendarRange aria-hidden="true" />
            <h3>{period.name}</h3>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setEditor({ kind: "period", id: period.id })}
          >
            <Pencil aria-hidden="true" /> Editar limites
          </Button>
          <p className={styles.range}>
            <span>
              {shortDate(civilDate(period.startDate))}
              <small>{period.startDate.getUTCFullYear()}</small>
            </span>
            <ArrowRight aria-hidden="true" />
            <span>
              {shortDate(civilDate(period.endDate))}
              <small>{period.endDate.getUTCFullYear()}</small>
            </span>
          </p>
        </li>
      ))}
    </ul>
  ) : (
    <EmptyState
      className={styles.empty}
      icon={<CalendarRange aria-hidden="true" />}
      title="Nenhum semestre cadastrado"
      description="Cadastre as datas reais dos semestres. Dias sem configuração não são tratados como férias."
    />
  );
}
