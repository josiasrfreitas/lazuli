"use client";
import { useState, type ReactElement } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  UserRound,
} from "lucide-react";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  InlineSkeleton,
  Popover,
  PopoverContent,
  PopoverClose,
  PopoverTrigger,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { CandidateDialog } from "./candidate-dialog";
import { CandidateAllocation } from "./candidate-allocation";
import { CandidateVisits } from "./candidate-visits";
import { VisitDialog } from "./visit-dialog";
import { dateLabel, dateOnly, dayLabel, statusLabels, timeLabel, type Candidate } from "./labels";

type EditTarget = "profile" | "availability";
type CandidateActions = {
  candidate: Candidate;
  onEdit: (target: EditTarget) => void;
  onSchedule: () => void;
};
export function CandidatePage({ id }: { id: string }): ReactElement {
  const query = trpc.admissions.byId.useQuery({ id }, { retry: false });
  if (query.isPending)
    return (
      <div className="grid gap-4 p-6" role="status">
        <InlineSkeleton className="h-8 w-56" />
        <InlineSkeleton className="h-40 w-full" />
        <span className="sr-only">Carregando interessado</span>
      </div>
    );
  if (!query.data)
    return (
      <div className="p-6">
        <Alert variant="destructive">
          {query.error?.message ?? "Não foi possível abrir o interessado."}
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </Alert>
      </div>
    );
  return <CandidateWorkspace candidate={query.data} />;
}
function CandidateWorkspace({ candidate }: { candidate: Candidate }): ReactElement {
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [scheduling, setScheduling] = useState(false);
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-6 overflow-y-auto p-4 sm:p-6">
      <CandidateHeader candidate={candidate} onEdit={() => setEditing("profile")} />
      {candidate.status === "ENROLLED" && candidate.enrollment && (
        <EnrollmentNotice classId={candidate.enrollment.classId} />
      )}
      <CandidateDetail
        candidate={candidate}
        onEdit={setEditing}
        onSchedule={() => setScheduling(true)}
      />
      {editing && (
        <CandidateDialog
          candidate={candidate}
          startAtAvailability={editing === "availability"}
          onClose={() => setEditing(null)}
        />
      )}
      {scheduling && <VisitDialog candidate={candidate} onClose={() => setScheduling(false)} />}
    </div>
  );
}
function CandidateHeader({
  candidate,
  onEdit,
}: {
  candidate: Candidate;
  onEdit: () => void;
}): ReactElement {
  const utils = trpc.useUtils();
  const status = trpc.admissions.setStatus.useMutation({
    onSuccess: () => utils.admissions.invalidate(),
  });
  return (
    <>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border pb-5">
        <CandidateIdentity candidate={candidate} />
        <HeaderActions
          candidate={candidate}
          onEdit={onEdit}
          pending={status.isPending}
          onStatus={() =>
            status.mutate({
              id: candidate.id,
              status: candidate.status === "ARCHIVED" ? "WAITING" : "ARCHIVED",
            })
          }
        />
      </header>
      {status.isError && <Alert variant="destructive">{status.error.message}</Alert>}
    </>
  );
}
function CandidateIdentity({ candidate }: { candidate: Candidate }): ReactElement {
  const since = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(
    candidate.createdAt,
  );
  return (
    <div className="flex min-w-0 items-start gap-3">
      <Avatar name={candidate.fullName} colorKey={candidate.id} />
      <div className="grid min-w-0 gap-2">
        <p className="text-caption text-muted-foreground">Entrada e alocação</p>
        <h1 className="break-words font-display text-h2 font-semibold text-heading">
          {candidate.fullName}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={candidate.status === "ENROLLED" ? "success" : "neutral"}>
            {statusLabels[candidate.status]}
          </Badge>
          <span className="text-caption text-muted-foreground">Desde {since}</span>
        </div>
      </div>
    </div>
  );
}
function HeaderActions({
  candidate,
  onEdit,
  pending,
  onStatus,
}: {
  candidate: Candidate;
  onEdit: () => void;
  pending: boolean;
  onStatus: () => void;
}): ReactElement {
  return (
    <div className="flex items-center gap-1">
      {candidate.status === "WAITING" && (
        <Button
          size="icon-compact-responsive"
          variant="ghost"
          aria-label="Editar interessado"
          onClick={onEdit}
        >
          <Pencil />
        </Button>
      )}
      {candidate.status !== "ENROLLED" && (
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="icon-compact-responsive"
                aria-label="Mais ações do interessado"
              />
            }
          >
            <MoreHorizontal />
          </PopoverTrigger>
          <PopoverContent align="end">
            <PopoverClose
              render={<Button variant="ghost" size="sm" />}
              disabled={pending}
              onClick={onStatus}
            >
              {candidate.status === "ARCHIVED" ? "Reabrir interesse" : "Arquivar interesse"}
            </PopoverClose>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
function EnrollmentNotice({ classId }: { classId: string }): ReactElement {
  return (
    <Alert variant="success">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Matrícula confirmada</p>
          <p className="text-caption">Continue o acompanhamento na turma.</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          nativeButton={false}
          render={<Link href={`/turmas/${classId}`} />}
        >
          Abrir turma
          <ArrowUpRight />
        </Button>
      </div>
    </Alert>
  );
}
function CandidateDetail(props: CandidateActions): ReactElement {
  const { candidate } = props;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="order-2 grid gap-6 lg:order-none">
        <CandidateProfile candidate={candidate} />
        <CandidateAvailability candidate={candidate} onRenew={() => props.onEdit("availability")} />
        {candidate.notes && (
          <section className="grid gap-2 border-t border-border pt-5">
            <h2 className="text-caption font-semibold">Observações</h2>
            <p className="whitespace-pre-wrap break-words text-caption text-muted-foreground">
              {candidate.notes}
            </p>
          </section>
        )}
      </aside>
      <div className="grid min-w-0 gap-6">
        {candidate.status === "WAITING" && (
          <CandidateAllocation candidate={candidate} onEdit={() => props.onEdit("availability")} />
        )}
        <EntryLessons candidate={candidate} onSchedule={props.onSchedule} />
      </div>
    </div>
  );
}
function CandidateAvailability({
  candidate,
  onRenew,
}: {
  candidate: Candidate;
  onRenew: () => void;
}): ReactElement {
  const expired = dateOnly(candidate.availableUntil) < candidate.today;
  return (
    <section className="grid gap-3 border-t border-border pt-5" aria-label="Disponibilidade">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-h3 font-semibold">Disponibilidade</h2>
        <Clock3 className="size-4 text-muted-foreground" />
      </div>
      {candidate.availability.map((slot) => (
        <div key={slot.id} className="flex items-center justify-between gap-3 text-caption">
          <span>{dayLabel(slot.weekday)}</span>
          <span className="font-numeric tabular-nums">
            {timeLabel(slot.startTime)}–{timeLabel(slot.endTime)}
          </span>
        </div>
      ))}
      <p className="text-caption text-muted-foreground">
        Confirmada até {dateLabel(candidate.availableUntil)}
      </p>
      {expired && candidate.status === "WAITING" && (
        <Alert variant="warning">
          <p>Confirme novamente os horários para continuar a alocação.</p>
          <Button variant="secondary" size="sm" onClick={onRenew}>
            Renovar disponibilidade
          </Button>
        </Alert>
      )}
    </section>
  );
}
function EntryLessons({
  candidate,
  onSchedule,
}: {
  candidate: Candidate;
  onSchedule: () => void;
}): ReactElement {
  return (
    <section className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-h3 font-semibold">Aulas de entrada</h2>
          <p className="mt-1 text-caption text-muted-foreground">
            O primeiro contato com a experiência de estudar aqui.
          </p>
        </div>
        {candidate.status === "WAITING" && (
          <Button
            variant="secondary"
            size="compact-responsive"
            disabled={dateOnly(candidate.availableUntil) < candidate.today}
            onClick={onSchedule}
          >
            <CalendarDays />
            Agendar aula
          </Button>
        )}
      </div>
      <CandidateVisits candidate={candidate} />
    </section>
  );
}
function CandidateProfile({ candidate }: { candidate: Candidate }): ReactElement {
  return (
    <section className="grid gap-4" aria-label="Perfil do interessado">
      <h2 className="text-h3 font-semibold">Interesse</h2>
      <div>
        <p className="font-medium">
          {candidate.scheduleType === "REGULAR" ? "Curso regular" : "Curso personalizado"}
        </p>
        <p className="text-caption text-muted-foreground">
          {candidate.format === "IN_PERSON" ? "Presencial" : "Online"} ·{" "}
          {candidate.stage?.name ?? "Nivelamento pendente"}
        </p>
      </div>
      <div className="grid gap-2 text-caption">
        {candidate.phone && (
          <p className="flex items-center gap-2">
            <Phone className="size-4 shrink-0 text-muted-foreground" />
            {candidate.phone}
          </p>
        )}
        {candidate.email && (
          <p className="flex items-start gap-2">
            <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="break-all">{candidate.email}</span>
          </p>
        )}
        {candidate.student && (
          <p className="flex items-center gap-2">
            <UserRound className="size-4 shrink-0 text-muted-foreground" />
            <span>Cadastro de aluno vinculado</span>
          </p>
        )}
      </div>
    </section>
  );
}
