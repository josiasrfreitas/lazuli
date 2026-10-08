"use client";

import { useState, type ReactElement } from "react";
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
  InlineSkeleton,
  Pagination,
} from "@lazuli/ui";
import { trpc, type QueryResult } from "~/lib/trpc";
import { dateLabel } from "./format";
import { formatFormat } from "../classes/labels";
import { MeetingDialog, type Meeting } from "./meeting-dialog";

const COVERAGE_PAGE_SIZE = 10;
type CoverageData = RouterOutputs["teachers"]["uncovered"];
type CoverageProps = { back: string };

export function TeacherCoverage({ back }: CoverageProps): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="compact-responsive" onClick={() => setOpen(true)}>
        Pendências de docente
      </Button>
      {open && <CoverageDialog back={back} onClose={() => setOpen(false)} />}
    </>
  );
}

type CoverageDialogProps = CoverageProps & { onClose: () => void };
function CoverageDialog({ back, onClose }: CoverageDialogProps): ReactElement {
  const [page, setPage] = useState(1);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const query = trpc.teachers.uncovered.useQuery({ page, pageSize: COVERAGE_PAGE_SIZE });
  if (meeting)
    return <MeetingDialog meeting={meeting} back={back} onClose={() => setMeeting(null)} />;
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
            <DialogTitle>Pendências de docente</DialogTitle>
            <DialogDescription>
              Aulas sem responsável. Abra uma aula para registrar cobertura ou acessar a turma e
              trocar o docente.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="my-5">
            <CoverageResults query={query} onOpen={setMeeting} />
          </DialogBody>
          <CoverageFooter data={query.data} setPage={setPage} onClose={onClose} />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

type CoverageFooterProps = {
  data: CoverageData | undefined;
  setPage: (page: number) => void;
  onClose: () => void;
};
function CoverageFooter({ data, setPage, onClose }: CoverageFooterProps): ReactElement {
  return (
    <DialogFooter>
      {data && (
        <Pagination
          page={data.page}
          pageCount={data.pageCount}
          onPageChange={setPage}
          label="Paginação de pendências"
        />
      )}
      <Button variant="secondary" size="compact-responsive" onClick={onClose}>
        Fechar
      </Button>
    </DialogFooter>
  );
}

type CoverageResultsProps = {
  query: QueryResult<CoverageData>;
  onOpen: (meeting: Meeting) => void;
};
function CoverageResults({ query, onOpen }: CoverageResultsProps): ReactElement {
  if (query.isError)
    return (
      <Alert variant="destructive">
        <p>Não foi possível carregar as pendências.</p>
        <Button variant="secondary" size="compact-responsive" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      </Alert>
    );
  if (!query.data || query.isFetching)
    return (
      <p role="status">
        Carregando pendências <InlineSkeleton />
      </p>
    );
  if (query.data.rows.length === 0) return <p role="status">Nenhuma aula pendente de docente.</p>;
  return (
    <ul className="divide-y divide-border">
      {query.data.rows.map((row) => (
        <CoverageRow key={row.id} meeting={row} onOpen={onOpen} />
      ))}
    </ul>
  );
}

type CoverageRowProps = { meeting: Meeting; onOpen: (meeting: Meeting) => void };
function CoverageRow({ meeting, onOpen }: CoverageRowProps): ReactElement {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="grid gap-1">
        <p className="text-control font-semibold">{meeting.classCode}</p>
        <p className="text-caption text-muted-foreground">
          {dateLabel(meeting.date)} · {meeting.startTime}–{meeting.endTime} ·{" "}
          {formatFormat(meeting.format)}
        </p>
      </div>
      <Button
        variant="secondary"
        size="compact-responsive"
        onClick={() => onOpen(meeting)}
        aria-label={`Cobrir ${meeting.classCode} em ${dateLabel(meeting.date)} às ${meeting.startTime}`}
      >
        Cobrir aula
      </Button>
    </li>
  );
}
