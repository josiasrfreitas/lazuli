"use client";
import type { JSX as ReactJSX, ReactNode } from "react";
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
type Options = RouterOutputs["students"]["intakeOptions"];
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
}): ReactJSX.Element {
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
  const allocate = useAllocateStudent(onClose);
  return (
    <AllocationDialogContent
      studentId={studentId}
      name={name}
      lead={lead}
      onClose={onClose}
      stageId={stageId}
      format={format}
      scheduleType={scheduleType}
      selectedId={selectedId}
      setStageId={setStageId}
      setFormat={setFormat}
      setScheduleType={setScheduleType}
      setSelectedId={setSelectedId}
      options={options}
      selected={selected}
      allocate={allocate}
    />
  );
}

function useAllocateStudent(
  onClose: () => void,
): ReturnType<typeof trpc.students.allocate.useMutation> {
  const utils = trpc.useUtils();
  return trpc.students.allocate.useMutation({
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
}

type AllocationDialogContentProps = {
  studentId: string;
  name: string;
  lead: Lead;
  onClose: () => void;
  stageId: string | null;
  format: "IN_PERSON" | "ONLINE";
  scheduleType: "REGULAR" | "PERSONALIZED";
  selectedId: string;
  setStageId: (value: string | null) => void;
  setFormat: (value: "IN_PERSON" | "ONLINE") => void;
  setScheduleType: (value: "REGULAR" | "PERSONALIZED") => void;
  setSelectedId: (value: string) => void;
  options: {
    data: Options | undefined;
    isFetching: boolean;
    error: { message: string } | null;
    refetch: () => void;
  };
  selected: Options["classes"][number] | undefined;
  allocate: ReturnType<typeof trpc.students.allocate.useMutation>;
};

function AllocationDialogContent(props: AllocationDialogContentProps): ReactJSX.Element {
  const { studentId, name, lead, onClose, stageId, format, scheduleType } = props;
  const { selectedId, setStageId, setFormat, setScheduleType, setSelectedId } = props;
  const { options, selected, allocate } = props;
  return (
    <AllocationDialogChrome name={name} onClose={onClose} pending={allocate.isPending}>
      <AllocationDialogBody
        lead={lead}
        stageId={stageId}
        format={format}
        scheduleType={scheduleType}
        onStageChange={(value) => {
          setStageId(value);
          setSelectedId("");
        }}
        onFormatChange={(value) => {
          setFormat(value);
          setSelectedId("");
        }}
        onScheduleTypeChange={(value) => {
          setScheduleType(value);
          setSelectedId("");
        }}
        data={options.data}
        fetching={options.isFetching}
        optionsError={options.error?.message}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onRetry={() => void options.refetch()}
        mutationError={allocate.error?.message}
      />
      <AllocationFooter
        pending={allocate.isPending}
        selectedName={selected?.name}
        disabled={!selected || !stageId || allocate.isPending || options.isFetching}
        onClose={onClose}
        onConfirm={() => {
          if (selected && stageId) allocate.mutate({ studentId, classId: selected.id, stageId });
        }}
      />
    </AllocationDialogChrome>
  );
}

function AllocationDialogChrome({
  name,
  onClose,
  pending,
  children,
}: {
  name: string;
  onClose: () => void;
  pending: boolean;
  children: ReactNode;
}): ReactJSX.Element {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="h-[min(52rem,calc(100dvh-4rem))] w-[calc(100%-2rem)] max-w-7xl md:w-[calc(100%-2rem)] md:max-w-7xl">
          <DialogHeader>
            <DialogTitle>Escolher turma</DialogTitle>
            <DialogDescription>{name} · alocação no semestre atual</DialogDescription>
          </DialogHeader>
          {children}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

type AllocationDialogBodyProps = {
  lead: Lead;
  stageId: string | null;
  format: "IN_PERSON" | "ONLINE";
  scheduleType: "REGULAR" | "PERSONALIZED";
  onStageChange: (value: string | null) => void;
  onFormatChange: (value: "IN_PERSON" | "ONLINE") => void;
  onScheduleTypeChange: (value: "REGULAR" | "PERSONALIZED") => void;
  data: Options | undefined;
  fetching: boolean;
  optionsError: string | undefined;
  selectedId: string;
  onSelect: (id: string) => void;
  onRetry: () => void;
  mutationError: string | undefined;
};

function AllocationDialogBody({
  lead,
  stageId,
  format,
  scheduleType,
  onStageChange,
  onFormatChange,
  onScheduleTypeChange,
  data,
  fetching,
  optionsError,
  selectedId,
  onSelect,
  onRetry,
  mutationError,
}: AllocationDialogBodyProps): ReactJSX.Element {
  return (
    <DialogBody className="mt-5 flex flex-col overflow-hidden">
      <AllocationFilters
        lead={lead}
        stageId={stageId}
        format={format}
        scheduleType={scheduleType}
        onStageChange={onStageChange}
        onFormatChange={onFormatChange}
        onScheduleTypeChange={onScheduleTypeChange}
      />
      <AllocationClassChoices
        stageId={stageId}
        data={data}
        fetching={fetching}
        optionsError={optionsError}
        onRetry={onRetry}
        selectedId={selectedId}
        onSelect={onSelect}
      />
      {mutationError && (
        <Alert variant="destructive" className="mt-3 shrink-0">
          {mutationError}
        </Alert>
      )}
    </DialogBody>
  );
}

function AllocationClassChoices({
  stageId,
  data,
  fetching,
  optionsError,
  onRetry,
  selectedId,
  onSelect,
}: {
  stageId: string | null;
  data: Options | undefined;
  fetching: boolean;
  optionsError: string | undefined;
  onRetry: () => void;
  selectedId: string;
  onSelect: (id: string) => void;
}): ReactJSX.Element {
  return (
    <div className="mt-5 flex min-h-0 flex-1 flex-col">
      {stageId ? (
        <IntakeClasses
          data={data}
          pending={fetching}
          error={optionsError}
          onRetry={onRetry}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ) : (
        <p className="rounded-md border border-dashed border-border p-6 text-caption text-muted-foreground">
          Escolha o estágio para consultar as turmas e seus horários.
        </p>
      )}
    </div>
  );
}

function AllocationFooter({
  pending,
  selectedName,
  disabled,
  onClose,
  onConfirm,
}: {
  pending: boolean;
  selectedName: string | undefined;
  disabled: boolean;
  onClose: () => void;
  onConfirm: () => void;
}): ReactJSX.Element {
  return (
    <DialogFooter className="mt-4 items-center border-t border-border pt-4">
      <Button variant="ghost" disabled={pending} onClick={onClose}>
        Cancelar
      </Button>
      <p className="mr-auto text-caption text-muted-foreground">
        {selectedName ?? "Selecione uma turma"}
      </p>
      <Button disabled={disabled} onClick={onConfirm}>
        {pending ? "Salvando…" : "Confirmar turma"}
      </Button>
    </DialogFooter>
  );
}

function AllocationFilters({
  lead,
  stageId,
  format,
  scheduleType,
  onStageChange,
  onFormatChange,
  onScheduleTypeChange,
}: {
  lead: Lead;
  stageId: string | null;
  format: "IN_PERSON" | "ONLINE";
  scheduleType: "REGULAR" | "PERSONALIZED";
  onStageChange: (value: string | null) => void;
  onFormatChange: (value: "IN_PERSON" | "ONLINE") => void;
  onScheduleTypeChange: (value: "REGULAR" | "PERSONALIZED") => void;
}): ReactJSX.Element {
  return (
    <div className="grid shrink-0 gap-3 border-b border-border pb-4">
      <div className="grid items-start gap-4 sm:grid-cols-[auto_auto_minmax(12rem,1fr)]">
        <InterestChoice
          label="Modalidade"
          value={scheduleType}
          options={{ REGULAR: "Regular", PERSONALIZED: "PPT" }}
          onChange={(value) => onScheduleTypeChange(value as typeof scheduleType)}
        />
        <InterestChoice
          label="Formato"
          value={format}
          options={{ IN_PERSON: "Presencial", ONLINE: "Online" }}
          onChange={(value) => onFormatChange(value as typeof format)}
        />
        <IntakeStageSelect
          value={stageId}
          onChange={onStageChange}
          initialOnly={!lead || lead.englishExperience === "NONE"}
          disabled={lead?.englishExperience === "SOME"}
        />
      </div>
      <p className="text-caption text-muted-foreground">
        Regular para o início do semestre; PPT para entrada durante o período.
      </p>
    </div>
  );
}
