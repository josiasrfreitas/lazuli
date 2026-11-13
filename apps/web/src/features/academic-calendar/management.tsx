"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarRange,
  Flag,
  Pencil,
  Plus,
} from "lucide-react";
import { Button, Tabs, TabsList, TabsTab, TabsPanel } from "@lazuli/ui";
import { CalendarChangeForm } from "./change-form";
import { CalendarHolidays } from "./holidays";
import { civilDate, shortDate } from "./date-model";
import type { AcademicYear } from "./model";
import styles from "./management.module.css";

export type CalendarEditor =
  | { kind: "period" | "interruption"; id?: string }
  | { kind: "holidays" };
const kinds = { HOLIDAY: "Feriado", RECESS: "Recesso", MAINTENANCE: "Manutenção", OTHER: "Outro" };
export function CalendarManagement({
  data,
  year,
  onClose,
}: {
  data: AcademicYear;
  year: number;
  onClose: () => void;
}) {
  const [editor, setEditor] = useState<CalendarEditor | null>(null);
  const [section, setSection] = useState("periods");
  const periods = data.periods.filter(
    (row) => row.startDate.getUTCFullYear() <= year && row.endDate.getUTCFullYear() >= year,
  );
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft aria-hidden="true" /> Voltar ao calendário
        </Button>
        <h1>
          Organizar o ano acadêmico <span>{year}</span>
        </h1>
        <p>Defina até quando as aulas acontecem e quais datas interrompem as atividades.</p>
      </header>
      <Tabs
        value={section}
        onValueChange={(value) => setSection(String(value))}
        variant="underline"
      >
        <TabsList aria-label="Configuração do calendário">
          <TabsTab value="periods">
            <CalendarRange aria-hidden="true" /> Semestres
          </TabsTab>
          <TabsTab value="interruptions">
            <Flag aria-hidden="true" /> Feriados e recessos
          </TabsTab>
        </TabsList>
        <TabsPanel value="periods" className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Limites dos semestres</h2>
              <p>As turmas usam estas datas para organizar suas aulas regulares.</p>
            </div>
            <Button size="sm" onClick={() => setEditor({ kind: "period" })}>
              <Plus aria-hidden="true" /> Novo semestre
            </Button>
          </div>
          {periods.length ? (
            <ul className={styles.periods}>
              {periods.map((period) => (
                <li key={period.id} className={styles.period}>
                  <CalendarRange aria-hidden="true" />
                  <div>
                    <h3>{period.name}</h3>
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
                    <p>Aulas regulares dentro deste intervalo.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditor({ kind: "period", id: period.id })}
                  >
                    <Pencil aria-hidden="true" /> Editar limites
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.empty}>
              <CalendarRange aria-hidden="true" />
              <h3>O ano ainda não tem limites definidos</h3>
              <p>
                Cadastre as datas reais dos semestres. Dias sem configuração não são tratados como
                férias.
              </p>
            </div>
          )}
          <div className={styles.explanation}>
            <h3>O que muda ao ajustar um semestre</h3>
            <p>
              Você confere as aulas afetadas e a carga disponível das turmas antes de aplicar.
              Atividades já realizadas são preservadas; o calendário não altera os contratos.
            </p>
          </div>
        </TabsPanel>
        <TabsPanel value="interruptions" className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Dias sem atividades acadêmicas</h2>
              <p>Feriados e recessos suspendem aulas, atendimentos e experimentais.</p>
            </div>
            <div className={styles.actions}>
              <Button size="sm" variant="secondary" onClick={() => setEditor({ kind: "holidays" })}>
                <CalendarDays aria-hidden="true" /> Buscar feriados
              </Button>
              <Button size="sm" onClick={() => setEditor({ kind: "interruption" })}>
                <Plus aria-hidden="true" /> Adicionar intervalo
              </Button>
            </div>
          </div>
          {data.interruptions.length ? (
            <ul className={styles.interruptions}>
              {data.interruptions.map((row) => (
                <li key={row.id} className={styles.interruption}>
                  <span className={styles.interruptionDate}>
                    {shortDate(civilDate(row.fromDate))}
                    {row.fromDate.getTime() !== row.throughDate.getTime() && (
                      <small>até {shortDate(civilDate(row.throughDate))}</small>
                    )}
                  </span>
                  <div>
                    <h3>{row.title}</h3>
                    <p>{kinds[row.kind]} · sem atividades acadêmicas</p>
                    {row.description && <p className={styles.description}>{row.description}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Editar ${row.title}`}
                    onClick={() => setEditor({ kind: "interruption", id: row.id })}
                  >
                    <Pencil aria-hidden="true" /> Editar
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.empty}>
              <Flag aria-hidden="true" />
              <h3>Nenhum feriado ou recesso cadastrado</h3>
              <p>Busque as sugestões de feriados ou adicione as datas da escola.</p>
            </div>
          )}
          <div className={styles.explanation}>
            <h3>Eventos e pausas têm efeitos diferentes</h3>
            <p>
              Um evento apenas informa uma data. Para suspender atividades, registre um feriado ou
              recesso. Ao remover uma pausa, aulas canceladas precisam ser reagendadas.
            </p>
          </div>
        </TabsPanel>
      </Tabs>
      {editor?.kind === "holidays" && (
        <CalendarHolidays year={year} data={data} onClose={() => setEditor(null)} />
      )}
      {editor && editor.kind !== "holidays" && (
        <CalendarChangeForm
          key={`${editor.kind}:${editor.id ?? "new"}`}
          mode={editor.kind}
          item={
            editor.kind === "period"
              ? data.periods.find((row) => row.id === editor.id)
              : data.interruptions.find((row) => row.id === editor.id)
          }
          onClose={() => setEditor(null)}
        />
      )}
    </section>
  );
}
