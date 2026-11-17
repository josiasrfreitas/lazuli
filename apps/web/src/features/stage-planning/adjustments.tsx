"use client";
import { useState, type ReactElement } from "react";
import {
  ArrowRight,
  CalendarPlus,
  CalendarCheck,
  Check,
  SlidersHorizontal,
  CalendarDays,
} from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { semesterOutlook } from "./outlook-model";
import type { Planning } from "./shared";
import { ScheduleAppointmentDialog } from "~/features/appointments/schedule-dialog";
import { ExtraClassesForm } from "./extra-classes-form";
import { EndClassesForm } from "./end-classes-form";
import styles from "./adjustments.module.css";

export function PlanningAdjustments({
  data,
  onStart,
}: {
  data: Planning;
  onStart: () => void;
}): ReactElement {
  const [mode, setMode] = useState<"choose" | "individual" | "extra" | "end" | null>(null);
  const [message, setMessage] = useState("");
  const utils = trpc.useUtils();
  const status = semesterOutlook(data).status;
  const recommended =
    status === "shortfall" ? "extra" : status === "margin" || status === "complete" ? "end" : null;
  const canStart =
    !data.scope.readOnly &&
    (data.plan?.plannedStartOn ?? data.preview?.plannedStartOn ?? data.scope.classStartOn) >
      data.scope.today;
  const saved = async (message: string) => {
    await utils.invalidate();
    setMode(null);
    setMessage(message);
  };
  return (
    <>
      <div className={styles.actions}>
        {message && (
          <span role="status" className={styles.success}>
            <Check size={15} aria-hidden="true" />
            {message}
          </span>
        )}
        {canStart && (
          <Button size="sm" variant="ghost" onClick={onStart}>
            <CalendarDays aria-hidden="true" />
            Alterar início
          </Button>
        )}
        {data.scope.canAdjust && !data.scope.readOnly && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setMode(data.scope.student ? "individual" : "choose")}
          >
            <SlidersHorizontal aria-hidden="true" />
            Ajustar aulas
          </Button>
        )}
      </div>
      {mode === "individual" && data.scope.student && (
        <ScheduleAppointmentDialog
          student={{ id: data.scope.student.id, name: data.scope.student.fullName }}
          initialPurpose="PPT_COMPLEMENT"
          onClose={() => setMode(null)}
        />
      )}
      {mode === "choose" && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setMode(null);
          }}
        >
          <DialogPortal>
            <DialogBackdrop />
            <DialogContent className="md:max-w-xl">
              <DialogHeader>
                <DialogTitle>Ajustar as aulas da turma</DialogTitle>
                <DialogDescription>
                  Escolha como acomodar o conteúdo no calendário.
                </DialogDescription>
              </DialogHeader>
              <DialogBody>
                <div className={styles.choices}>
                  <button type="button" onClick={() => setMode("extra")}>
                    <CalendarPlus aria-hidden="true" />
                    <span>
                      <strong>
                        Adicionar aulas
                        {recommended === "extra" && <Badge variant="info">Recomendado</Badge>}
                      </strong>
                      <span>
                        Atendimentos para a turma inteira, uma vez ou toda semana. Inclusive nas
                        férias.
                      </span>
                    </span>
                    <ArrowRight aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => setMode("end")}>
                    <CalendarCheck aria-hidden="true" />
                    <span>
                      <strong>
                        Encerrar antes
                        {recommended === "end" && <Badge variant="info">Recomendado</Badge>}
                      </strong>
                      <span>
                        Defina a última aula e confira os cancelamentos antes de confirmar.
                      </span>
                    </span>
                    <ArrowRight aria-hidden="true" />
                  </button>
                </div>
              </DialogBody>
            </DialogContent>
          </DialogPortal>
        </Dialog>
      )}
      {mode === "extra" && (
        <ExtraClassesForm
          data={data}
          onClose={() => setMode(null)}
          onBack={() => setMode("choose")}
          onSaved={saved}
        />
      )}
      {mode === "end" && (
        <EndClassesForm
          data={data}
          onClose={() => setMode(null)}
          onBack={() => setMode("choose")}
          onSaved={saved}
        />
      )}
    </>
  );
}
