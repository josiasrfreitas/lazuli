import type { ReactElement, ReactNode } from "react";

import { MessageCircle } from "lucide-react";

import type { StudentListRow } from "@lazuli/validators";
import {
  Avatar,
  Badge,
  Button,
  cn,
  Sheet,
  SheetBackdrop,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetPortal,
  SheetTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@lazuli/ui";

import { EM_DASH } from "~/lib/format";

import { useStudentPreview, type SelectedStudent, type StudentPreviewQuery } from "./logic";
import {
  attendanceCellVm,
  financeCellVm,
  statusBadgeVm,
  whatsAppVm,
  type FactCellVm,
} from "./view-model";

const TONE_TEXT: Record<FactCellVm["tone"], string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  success: "text-success",
  destructive: "text-destructive",
};

function Fact({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-micro font-semibold uppercase tracking-label text-muted-foreground">
        {label}
      </dt>
      <dd className="text-caption text-foreground">{children}</dd>
    </div>
  );
}

function FactValue({ vm }: { vm: FactCellVm }): ReactElement {
  return (
    <span className={cn(TONE_TEXT[vm.tone], vm.numeric && "font-numeric tabular-nums")}>
      {vm.label}
    </span>
  );
}

function StudentFacts({ row }: { row: StudentListRow }): ReactElement {
  return (
    <dl className="grid gap-4">
      <Fact label="Turma">
        {row.enrollment === null ? (
          <span className="text-muted-foreground">{EM_DASH}</span>
        ) : (
          <span className="flex flex-col gap-0.5">
            <span className="font-numeric tabular-nums">{row.enrollment.classCode}</span>
            <span className="text-micro text-muted-foreground">{row.enrollment.scheduleLabel}</span>
          </span>
        )}
      </Fact>
      <Fact label="Professor">
        {row.enrollment?.teacherName ?? <span className="text-muted-foreground">{EM_DASH}</span>}
      </Fact>
      <Fact label="Frequência">
        <FactValue vm={attendanceCellVm(row.attendance)} />
      </Fact>
      <Fact label="Financeiro">
        <FactValue vm={financeCellVm(row.finance)} />
      </Fact>
      <Fact label="Telefone">
        {row.phone === null ? (
          <span className="text-muted-foreground">{EM_DASH}</span>
        ) : (
          <span className="font-numeric tabular-nums">{row.phone}</span>
        )}
      </Fact>
    </dl>
  );
}

function PanelActions({ row }: { row: StudentListRow }): ReactElement {
  const whatsApp = whatsAppVm(row);

  return (
    <SheetFooter className="mt-auto flex-row">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="inline-flex" tabIndex={0}>
                <Button disabled variant="secondary">
                  Abrir perfil
                </Button>
              </span>
            }
          />
          <TooltipContent side="top">Em breve</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {whatsApp === null ? null : (
        <Button
          nativeButton={false}
          render={<a href={whatsApp.url} rel="noreferrer" target="_blank" />}
        >
          <MessageCircle aria-hidden="true" className="size-4" />
          WhatsApp
        </Button>
      )}
    </SheetFooter>
  );
}

function PanelContent({ preview }: { preview: StudentPreviewQuery }): ReactElement {
  if (preview.data === undefined) {
    return (
      <>
        {/* Keeps the dialog labelled for assistive tech before the name arrives. */}
        <SheetTitle className="sr-only">Aluno</SheetTitle>
        <SheetBody className="mt-2 text-caption text-muted-foreground" role="status">
          {preview.error === null ? "Carregando aluno…" : "Não foi possível carregar o aluno."}
        </SheetBody>
      </>
    );
  }

  const row = preview.data;
  const status = statusBadgeVm(row.status);

  return (
    <>
      <div className="flex flex-col items-start gap-4 pr-8">
        <Avatar aria-hidden colorKey={row.id} name={row.fullName} size="lg" />
        <div className="flex flex-col gap-2">
          <SheetTitle>{row.fullName}</SheetTitle>
          <div className="flex items-center gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            {row.isMinor ? <Badge variant="neutral">menor</Badge> : null}
          </div>
        </div>
      </div>
      <SheetBody className="mt-6">
        <StudentFacts row={row} />
      </SheetBody>
      <PanelActions row={row} />
    </>
  );
}

/** Opened by `?aluno=<id>`; closing clears the param and returns focus. */
export function StudentPreviewPanel({ selection }: { selection: SelectedStudent }): ReactElement {
  const preview = useStudentPreview(selection.selectedId);

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          selection.clear();
        }
      }}
      open={selection.selectedId !== null}
    >
      <SheetPortal>
        <SheetBackdrop />
        <SheetContent closeLabel="Fechar painel">
          <PanelContent preview={preview} />
        </SheetContent>
      </SheetPortal>
    </Sheet>
  );
}
