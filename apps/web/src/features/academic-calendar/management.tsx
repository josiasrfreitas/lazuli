"use client";
import { CalendarDays, Plus } from "lucide-react";
import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogDescription,
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
  onEdit,
  onClose,
}: {
  data: AcademicYear;
  year: number;
  onEdit: (editor: CalendarEditor) => void;
  onClose: () => void;
}) {
  const periods = data.periods.filter(
    (row) => row.startDate.getUTCFullYear() <= year && row.endDate.getUTCFullYear() >= year,
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar calendário · {year}</DialogTitle>
            <DialogDescription>
              Defina os semestres e os períodos sem atividades acadêmicas.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-6">
            <section className="grid gap-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">Semestres</h2>
                <Button size="sm" variant="secondary" onClick={() => onEdit({ kind: "period" })}>
                  <Plus /> Novo semestre
                </Button>
              </div>
              {periods.length ? (
                <ul className="divide-y divide-border">
                  {periods.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-3 py-2">
                      <div>
                        <p>{row.name}</p>
                        <p className="text-caption text-muted-foreground">
                          {date(row.startDate)} — {date(row.endDate)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit({ kind: "period", id: row.id })}
                      >
                        Editar
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-caption text-muted-foreground">
                  Nenhum semestre configurado neste ano. Defina as datas para delimitar as aulas
                  regulares.
                </p>
              )}
              <p className="text-caption text-muted-foreground">
                O intervalo entre dois semestres é exibido como férias acadêmicas.
              </p>
            </section>
            <section className="grid gap-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">Feriados e recessos</h2>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onEdit({ kind: "interruption" })}
                >
                  <Plus /> Novo recesso
                </Button>
              </div>
              {data.interruptions.length ? (
                <ul className="divide-y divide-border">
                  {data.interruptions.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-3 py-2">
                      <div>
                        <p>{row.title}</p>
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
                        Editar
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-caption text-muted-foreground">
                  Cadastre feriados locais, recessos ou outros dias sem atividades.
                </p>
              )}
              <Button size="sm" variant="secondary" onClick={() => onEdit({ kind: "holidays" })}>
                <CalendarDays /> Buscar feriados
              </Button>
            </section>
          </DialogBody>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
