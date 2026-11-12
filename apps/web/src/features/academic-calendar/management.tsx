"use client";
import { useDialogExpansion } from "./use-dialog-expansion";
import { useState } from "react";
import { CalendarChangeForm } from "./change-form";
import { CalendarHolidays } from "./holidays";
import styles from "./configuration.module.css";
import { CalendarDays, Plus, Pencil } from "lucide-react";
import {
  Button,
  Tabs,
  TabsList,
  TabsTab,
  TabsPanel,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogPortal,
  DialogTitle,
} from "@lazuli/ui";
import { formatDateOnlyBR } from "~/lib/format";
import type { AcademicYear } from "./model";
const date = (value: Date) => formatDateOnlyBR(value.toISOString().slice(0, 10));
export type CalendarEditor =
  | { kind: "period" | "interruption"; id?: string }
  | { kind: "holidays" };
export function CalendarManagement({
  data,
  year,
  onClose,
}: {
  data: AcademicYear;
  year: number;
  onClose: () => void;
}) {
  const { dialogRef, surfaceRef } = useDialogExpansion();
  const [editor, onEdit] = useState<CalendarEditor | null>(null);
  const [pending, setPending] = useState(false);
  const [section, setSection] = useState("periods");
  const back = () => {
    onEdit(null);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>('[role="dialog"] [role="tab"][aria-selected="true"]')
        ?.focus(),
    );
  };
  const periods = data.periods.filter(
    (row) => row.startDate.getUTCFullYear() <= year && row.endDate.getUTCFullYear() >= year,
  );
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
          ref={dialogRef}
          className={`${styles.dialog} top-8 w-[calc(100vw-2rem)] translate-y-0 max-h-[calc(100dvh-4rem)] md:max-w-6xl`}
          motion="subtle"
          showCloseButton={!pending}
        >
          <span ref={surfaceRef} className={styles.dialogSurface} aria-hidden="true" />
          {editor ? (
            editor.kind === "holidays" ? (
              <CalendarHolidays
                year={year}
                data={data}
                onPendingChange={setPending}
                embedded
                onBack={back}
                onClose={back}
              />
            ) : (
              <CalendarChangeForm
                key={`${editor.kind}:${editor.id ?? "new"}`}
                onPendingChange={setPending}
                mode={editor.kind}
                item={
                  editor.kind === "period"
                    ? data.periods.find((row) => row.id === editor.id)
                    : data.interruptions.find((row) => row.id === editor.id)
                }
                embedded
                onBack={back}
                onClose={back}
              />
            )
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Configurar calendário · {year}</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <Tabs
                  value={section}
                  onValueChange={(value) => setSection(String(value))}
                  variant="underline"
                  className={styles.sections}
                >
                  <TabsList aria-label="Configuração do calendário">
                    <TabsTab value="periods">Semestres</TabsTab>
                    <TabsTab value="interruptions">Feriados e recessos</TabsTab>
                  </TabsList>
                  <TabsPanel value="periods" className={styles.section}>
                    <div className={styles.sectionHeader}>
                      <Button size="sm" onClick={() => onEdit({ kind: "period" })}>
                        <Plus /> Novo semestre
                      </Button>
                    </div>
                    {periods.length ? (
                      <ul className={styles.periods}>
                        {periods.map((row) => (
                          <li key={row.id} className={styles.entry}>
                            <div className="min-w-0">
                              <p className="break-words">{row.name}</p>
                              <p className="text-caption text-muted-foreground">
                                {date(row.startDate)} — {date(row.endDate)}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onEdit({ kind: "period", id: row.id })}
                            >
                              <Pencil aria-hidden="true" /> Editar
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-caption text-muted-foreground">
                        Nenhum semestre cadastrado.
                      </p>
                    )}
                  </TabsPanel>
                  <TabsPanel value="interruptions" className={styles.section}>
                    <div className={styles.sectionHeader}>
                      <div className={styles.actions}>
                        <Button size="sm" onClick={() => onEdit({ kind: "holidays" })}>
                          <CalendarDays /> Buscar feriados
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onEdit({ kind: "interruption" })}
                        >
                          <Plus /> Novo recesso
                        </Button>
                      </div>
                    </div>
                    {data.interruptions.length ? (
                      <ul className={styles.entries}>
                        {data.interruptions.map((row) => (
                          <li key={row.id} className={styles.entry}>
                            <div className="min-w-0">
                              <p className="break-words">{row.title}</p>
                              <p className="text-caption text-muted-foreground">
                                {date(row.fromDate)}
                                {row.fromDate.getTime() !== row.throughDate.getTime()
                                  ? ` — ${date(row.throughDate)}`
                                  : ""}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onEdit({ kind: "interruption", id: row.id })}
                            >
                              <Pencil aria-hidden="true" /> Editar
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-caption text-muted-foreground">
                        Nenhum feriado ou recesso cadastrado.
                      </p>
                    )}
                  </TabsPanel>
                </Tabs>
              </DialogBody>
            </>
          )}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
