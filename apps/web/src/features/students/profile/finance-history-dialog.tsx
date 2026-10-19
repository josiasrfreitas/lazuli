"use client";
import { useState } from "react";
import { History } from "lucide-react";
import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  InlineSkeleton,
  SegmentedControl,
  SegmentedControlItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { ActivityTimeline } from "~/features/activity/activity-timeline";
import { StudentTreatments } from "~/features/financial-treatments/student-treatments";

export function FinanceHistoryDialog({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label="Histórico financeiro" />}
            />
          }
        >
          <History aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Histórico financeiro</TooltipContent>
      </Tooltip>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="h-160 md:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Histórico financeiro</DialogTitle>
            <DialogDescription>
              {studentName ?? "Aluno"} · Contratos, cobranças, pagamentos e tratativas
            </DialogDescription>
          </DialogHeader>
          {open && <FinanceHistoryContent studentId={studentId} />}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function FinanceHistoryContent({ studentId }: { studentId: string }) {
  const [tab, setTab] = useState("activity");
  const history = trpc.activity.list.useInfiniteQuery(
    { financialStudentId: studentId, area: "FINANCIAL", period: "ALL", pageSize: 25 },
    { getNextPageParam: (page) => page.nextCursor },
  );
  const rows = history.data?.pages.flatMap((page) => page.rows) ?? [];
  return (
    <>
      <div className="py-4">
        <SegmentedControl
          aria-label="Tipo de histórico financeiro"
          size="sm"
          value={tab}
          onValueChange={setTab}
        >
          <SegmentedControlItem value="activity">Todas as atividades</SegmentedControlItem>
          <SegmentedControlItem value="treatments">Detalhes das tratativas</SegmentedControlItem>
        </SegmentedControl>
      </div>
      <DialogBody>
        {tab === "treatments" ? (
          <StudentTreatments studentId={studentId} />
        ) : (
          <div className="grid gap-5 pb-2">
            {history.isPending && <InlineSkeleton className="h-48 w-full" />}
            {history.isError && (
              <div role="alert" className="grid gap-2">
                Não foi possível carregar o histórico financeiro.
                <Button variant="secondary" size="sm" onClick={() => void history.refetch()}>
                  Tentar novamente
                </Button>
              </div>
            )}
            {!history.isPending && !history.isError && rows.length === 0 && (
              <p className="py-6 text-caption text-muted-foreground">
                Nenhuma atividade financeira registrada para este aluno.
              </p>
            )}
            {rows.length > 0 && <ActivityTimeline rows={rows} />}
            {history.hasNextPage && (
              <Button
                variant="secondary"
                size="sm"
                disabled={history.isFetchingNextPage}
                onClick={() => void history.fetchNextPage()}
              >
                {history.isFetchingNextPage ? "Carregando…" : "Carregar mais atividades"}
              </Button>
            )}
          </div>
        )}
      </DialogBody>
    </>
  );
}
