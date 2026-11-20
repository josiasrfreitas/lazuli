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
  const recommended = recommendedAction(status);
  const saved = async (message: string): Promise<void> => {
    await utils.invalidate();
    setMode(null);
    setMessage(message);
  };
  return (
    <>
      <AdjustmentButtons
        data={data}
        message={message}
        onStart={onStart}
        onAdjust={() => setMode(data.scope.student ? "individual" : "choose")}
      />
      {mode === "individual" && data.scope.student && (
        <ScheduleAppointmentDialog
          student={{ id: data.scope.student.id, name: data.scope.student.fullName }}
          initialPurpose="PPT_COMPLEMENT"
          onClose={() => setMode(null)}
        />
      )}
      {mode === "choose" && <AdjustmentChoices recommended={recommended} choose={setMode} />}
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

function AdjustmentButtons({
  data,
  message,
  onStart,
  onAdjust,
}: {
  data: Planning;
  message: string;
  onStart: () => void;
  onAdjust: () => void;
}): ReactElement {
  const startOn =
    data.plan?.plannedStartOn ?? data.preview?.plannedStartOn ?? data.scope.classStartOn;
  const canStart = !data.scope.readOnly && startOn > data.scope.today;
  return (
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
        <Button size="sm" variant="secondary" onClick={onAdjust}>
          <SlidersHorizontal aria-hidden="true" />
          Ajustar aulas
        </Button>
      )}
    </div>
  );
}

function recommendedAction(
  status: ReturnType<typeof semesterOutlook>["status"],
): "extra" | "end" | null {
  if (status === "shortfall") return "extra";
  return status === "margin" || status === "complete" ? "end" : null;
}

function AdjustmentChoices({
  recommended,
  choose,
}: {
  recommended: "extra" | "end" | null;
  choose: (mode: "extra" | "end" | null) => void;
}): ReactElement {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) choose(null);
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="md:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ajustar as aulas da turma</DialogTitle>
            <DialogDescription>Escolha como acomodar o conteúdo no calendário.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className={styles.choices}>
              <button type="button" onClick={() => choose("extra")}>
                <CalendarPlus aria-hidden="true" />
                <span>
                  <strong>
                    Adicionar aulas
                    {recommended === "extra" && <Badge variant="info">Recomendado</Badge>}
                  </strong>
                  <span>
                    Atendimentos para a turma inteira, uma vez ou toda semana. Inclusive nas férias.
                  </span>
                </span>
                <ArrowRight aria-hidden="true" />
              </button>
              <button type="button" onClick={() => choose("end")}>
                <CalendarCheck aria-hidden="true" />
                <span>
                  <strong>
                    Encerrar antes
                    {recommended === "end" && <Badge variant="info">Recomendado</Badge>}
                  </strong>
                  <span>Defina a última aula e confira os cancelamentos antes de confirmar.</span>
                </span>
                <ArrowRight aria-hidden="true" />
              </button>
            </div>
          </DialogBody>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
