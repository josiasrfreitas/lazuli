"use client";
import { useState } from "react";
import type { RouterOutputs } from "@lazuli/api";
import {
  Alert,
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  getScheduleCalendarRange,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { toDateOnlySaoPaulo } from "~/lib/format";
import { InterestChoice } from "~/features/admissions/candidate-fields";
import { IntakeStageSelect } from "~/features/admissions/intake-fields";
import { IntakeClasses } from "./intake-classes";

type Lead = RouterOutputs["students"]["pendingActions"]["lead"];
export function StudentAllocationDialog({
  studentId,
  name,
  lead,
  onClose,
}: {
  studentId: string;
  name: string;
  lead: Lead;
  onClose: () => void;
}) {
  const [stageId, setStageId] = useState<string | null>(lead?.stageId ?? null);
  const [format, setFormat] = useState<"IN_PERSON" | "ONLINE">(lead?.format ?? "IN_PERSON");
  const [scheduleType, setScheduleType] = useState<"REGULAR" | "PERSONALIZED">(
    lead?.scheduleType ?? "PERSONALIZED",
  );
  const [selectedId, setSelectedId] = useState("");
  const range = getScheduleCalendarRange({ date: toDateOnlySaoPaulo(new Date()), view: "week" });
  const options = trpc.students.intakeOptions.useQuery({
    stageId,
    format,
    scheduleType,
    from: range.from,
    through: range.through,
  });
  const selected = options.data?.classes.find((row) => row.id === selectedId);
  const utils = trpc.useUtils();
  const allocate = trpc.students.allocate.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.students.invalidate(),
        utils.enrollment.invalidate(),
        utils.admissions.invalidate(),
        utils.semesterOrganization.invalidate(),
      ]);
      onClose();
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !allocate.isPending) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="h-[min(52rem,calc(100dvh-4rem))] w-[calc(100%-2rem)] max-w-7xl md:w-[calc(100%-2rem)] md:max-w-7xl">
          <DialogHeader>
            <DialogTitle>Escolher turma</DialogTitle>
            <DialogDescription>{name} · alocação no semestre atual</DialogDescription>
          </DialogHeader>
          <DialogBody className="mt-5 flex flex-col overflow-hidden">
            <div className="grid shrink-0 gap-3 border-b border-border pb-4">
              <div className="grid items-start gap-4 sm:grid-cols-[auto_auto_minmax(12rem,1fr)]">
                <InterestChoice
                  label="Modalidade"
                  value={scheduleType}
                  options={{ REGULAR: "Regular", PERSONALIZED: "PPT" }}
                  onChange={(value) => {
                    setScheduleType(value as typeof scheduleType);
                    setSelectedId("");
                  }}
                />
                <InterestChoice
                  label="Formato"
                  value={format}
                  options={{ IN_PERSON: "Presencial", ONLINE: "Online" }}
                  onChange={(value) => {
                    setFormat(value as typeof format);
                    setSelectedId("");
                  }}
                />
                <IntakeStageSelect
                  value={stageId}
                  onChange={(value) => {
                    setStageId(value);
                    setSelectedId("");
                  }}
                  initialOnly={!lead || lead.englishExperience === "NONE"}
                  disabled={lead?.englishExperience === "SOME"}
                />
              </div>
              <p className="text-caption text-muted-foreground">
                Regular para o início do semestre; PPT para entrada durante o período.
              </p>
            </div>
            <div className="mt-5 flex min-h-0 flex-1 flex-col">
              {stageId ? (
                <IntakeClasses
                  data={options.data}
                  pending={options.isFetching}
                  error={options.error?.message}
                  onRetry={() => void options.refetch()}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ) : (
                <p className="rounded-md border border-dashed border-border p-6 text-caption text-muted-foreground">
                  Escolha o estágio para consultar as turmas e seus horários.
                </p>
              )}
            </div>
            {allocate.error && (
              <Alert variant="destructive" className="mt-3 shrink-0">
                {allocate.error.message}
              </Alert>
            )}
          </DialogBody>
          <DialogFooter className="mt-4 items-center border-t border-border pt-4">
            <Button variant="ghost" disabled={allocate.isPending} onClick={onClose}>
              Cancelar
            </Button>
            <p className="mr-auto text-caption text-muted-foreground">
              {selected?.name ?? "Selecione uma turma"}
            </p>
            <Button
              disabled={!selected || !stageId || allocate.isPending || options.isFetching}
              onClick={() => {
                if (selected && stageId)
                  allocate.mutate({ studentId, classId: selected.id, stageId });
              }}
            >
              {allocate.isPending ? "Salvando…" : "Confirmar turma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
