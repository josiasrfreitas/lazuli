"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { Button, Input } from "@lazuli/ui";
import { z, calendarDateSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { TaskDialog, NarrativeField, useValidation } from "~/features/shared/task-form";
import { TextControl, SelectControl } from "~/features/classes/form-controls";
import { ClassPlanForm, SemesterForm } from "~/features/semester-organization/plan-form";
import { PlacementForm } from "~/features/semester-organization/placement-form";
import { AvailabilityForm } from "~/features/semester-organization/availability-form";
import { ReasonDialog, PlacementHistory } from "~/features/semester-organization/action-dialogs";
import {
  dateOnly,
  scheduleLabel,
  useOrganizationRefresh,
} from "~/features/semester-organization/shared";
import { NewStudentDialog } from "~/features/students/new-student/new-student-dialog";
import type { OrganizationAction, Placement, SemesterBoard } from "./model";
import s from "./organization.module.css";
import { ClosureForm, PeriodForm, HolidayForm } from "./calendar-forms";
import { RenewalDialog } from "./renewal";
import { ContinuityDialog, PlanStatusDialog } from "./continuity";

export type OrganizationDialogProps = {
  action: OrganizationAction;
  board: SemesterBoard;
  onAction: (action: OrganizationAction) => void;
  onClose: () => void;
  onSemester: (id: string) => void;
  onPlan: (id: string) => void;
  onFeedback: (message: string) => void;
};
type Props = OrganizationDialogProps;
export function OrganizationDialogs(props: Props) {
  const { action, board, onClose, onAction } = props;
  const [invalidate, setInvalidate] = useState<string | null>(null);
  const refresh = useOrganizationRefresh();
  switch (action.kind) {
    case "continuity":
      return (
        <ContinuityDialog row={action.row} board={board} onClose={onClose} onAction={onAction} />
      );
    case "planStatus":
      return (
        <PlanStatusDialog
          plan={action.plan}
          open={action.open}
          onClose={onClose}
          onFeedback={props.onFeedback}
        />
      );
    case "renew":
      return (
        <RenewalDialog
          contractId={action.contractId}
          onClose={onClose}
          onSaved={() =>
            props.onFeedback(
              "Contrato renovado com os termos revisados. A alocação pedagógica permanece independente.",
            )
          }
        />
      );
    case "plan":
      return (
        <ClassPlanForm
          semesterId={board.semester.id}
          {...(action.plan ? { plan: action.plan } : {})}
          {...(action.group ? { group: action.group } : {})}
          onClose={onClose}
          onSaved={props.onPlan}
        />
      );
    case "newSemester":
      return <SemesterForm onClose={onClose} onSaved={props.onSemester} />;
    case "placement":
      return (
        <PlacementForm
          studentId={action.studentId}
          board={board}
          {...(action.row ? { row: action.row } : {})}
          {...(action.planId ? { initialPlanId: action.planId } : {})}
          onClose={onClose}
        />
      );
    case "withdraw":
      return <ReasonDialog action="withdraw" row={action.row} board={board} onClose={onClose} />;
    case "history":
      return <PlacementHistory row={action.row} onClose={onClose} />;
    case "availability": {
      const intent = board.intents.find((item) => item.studentId === action.studentId);
      const row =
        board.placements.find((item) => item.studentId === action.studentId) ??
        (intent
          ? {
              id: intent.id,
              version: 0,
              studentId: intent.studentId,
              studentName: intent.studentName,
            }
          : undefined);
      return invalidate && row ? (
        <ReasonDialog
          action="invalidate"
          row={row}
          previousId={invalidate}
          board={board}
          onClose={onClose}
        />
      ) : (
        <AvailabilityForm
          studentId={action.studentId}
          board={board}
          onClose={onClose}
          onInvalidate={setInvalidate}
        />
      );
    }
    case "move":
    case "decline":
      return <MovementForm {...props} rows={action.rows} decline={action.kind === "decline"} />;
    case "closure":
      return (
        <ClosureForm {...props} initialDate={action.date ?? dateOnly(board.semester.startDate)} />
      );
    case "period":
      return <PeriodForm {...props} />;
    case "holidays":
      return <HolidayForm {...props} />;
    case "findStudent":
      return <FindStudent board={board} onClose={onClose} onAction={onAction} />;
    case "student":
      return (
        <NewStudentDialog
          open
          initialSemesterId={board.semester.id}
          onOpenChange={(open) => {
            if (!open) onClose();
          }}
          onCreated={() => {
            void refresh();
            onClose();
            props.onFeedback("Aluno cadastrado. A intenção pedagógica já aparece na organização.");
          }}
        />
      );
  }
}

function MovementForm({
  action,
  rows,
  decline,
  board,
  onClose,
}: Props & { rows: Placement[]; decline: boolean }): ReactJSX.Element {
  const [targetSemesterId, setTargetSemesterId] = useState(board.semester.id);
  const periods = trpc.semesterOrganization.semesters.useQuery();
  const targetQuery = trpc.semesterOrganization.detail.useQuery(
    { semesterId: targetSemesterId },
    { enabled: !decline && targetSemesterId !== board.semester.id },
  );
  const targetBoard = targetSemesterId === board.semester.id ? board : targetQuery.data;
  const [planId, setPlanId] = useState("planId" in action ? (action.planId ?? "") : "");
  const [date, setDate] = useState(
    formatDateOnlyBR(
      [dateOnly(board.semester.startDate), toDateOnlySaoPaulo(new Date())].sort().at(-1),
    ),
  );
  const [reason, setReason] = useState("");
  const validation = useValidation(),
    refresh = useOrganizationRefresh();
  const options = {
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  };
  const move = trpc.semesterOrganization.move.useMutation(options),
    stop = trpc.semesterOrganization.decline.useMutation(options);
  const mutation = decline ? stop : move;
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title={decline ? "Registrar não continuidade" : "Transferir alunos"}
      description={`${rows.length} ${rows.length === 1 ? "aluno" : "alunos"} · ${board.semester.name}`}
      formId="organization-movement"
      firstField={decline ? "movement-reason" : "movement-plan"}
      submitLabel={decline ? "Registrar não continuidade" : "Salvar transferência para revisão"}
      pending={mutation.isPending}
      error={mutation.error?.message}
      onClose={onClose}
      bodyRef={validation.body}
    >
      <form
        className={s.form}
        id="organization-movement"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (mutation.isPending) return;
          const base = {
            semesterId: board.semester.id,
            selections: rows.map(({ id, version }) => ({ id, version })),
          };
          if (decline) {
            const values = validation.validate(
              z.object({ reason: z.string().trim().min(3, "Informe o motivo.").max(1200) }),
              { reason },
            );
            if (values) stop.mutate({ ...base, ...values });
          } else {
            const values = validation.validate(
              z.object({
                planId: z.string().uuid("Escolha uma turma."),
                effectiveDate: calendarDateSchema,
                reason: z.string().trim().max(1200),
              }),
              { planId, effectiveDate: parseDateBR(date) ?? "", reason },
            );
            if (values)
              move.mutate({
                ...base,
                ...values,
                targetSemesterId,
                targetVersions: Object.fromEntries(
                  (targetBoard?.placements ?? []).map((row) => [row.id, row.version]),
                ),
              });
          }
        }}
      >
        <div className={s.summary}>
          {rows.map((row) => (
            <div className={s.row} key={row.id}>
              <strong>{row.studentName}</strong>
              <span className={s.small}>
                {row.stageCode} ·{" "}
                {board.plans.find((plan) => plan.id === row.planId)?.name ?? "Sem turma"}
              </span>
            </div>
          ))}
        </div>
        {decline ? (
          <p className={s.small}>
            Retira a continuidade deste semestre. O vínculo atual e os contratos permanecem sujeitos
            às suas próprias datas e condições.
          </p>
        ) : (
          <>
            <SelectControl
              name="movement-semester"
              label="Semestre de destino"
              value={targetSemesterId}
              onChange={(id) => {
                setTargetSemesterId(id);
                setPlanId("");
                const period = periods.data?.find((item) => item.id === id);
                if (period)
                  setDate(
                    formatDateOnlyBR(
                      [dateOnly(period.startDate), toDateOnlySaoPaulo(new Date())].sort().at(-1),
                    ),
                  );
              }}
              choices={(periods.data ?? [])
                .filter((period) => dateOnly(period.endDate) >= toDateOnlySaoPaulo(new Date()))
                .map((period) => ({ value: period.id, label: period.name }))}
            />
            {targetQuery.error && (
              <p role="alert" className={s.attention}>
                {targetQuery.error.message}
              </p>
            )}
            <SelectControl
              name="movement-plan"
              label="Turma de destino"
              value={planId}
              onChange={setPlanId}
              choices={(targetBoard?.plans ?? [])
                .filter((plan) => plan.active)
                .map((plan) => ({
                  value: plan.id,
                  label: `${plan.name} · ${scheduleLabel(plan.slots)}`,
                }))}
              error={validation.errors.planId}
            />
            <div className="w-40">
              <TextControl
                name="movement-date"
                label="Válida a partir de"
                value={date}
                onChange={(value) => setDate(maskDateBR(value))}
                inputMode="numeric"
                placeholder="dd/mm/aaaa"
                error={validation.errors.effectiveDate}
              />
            </div>
            <p className={s.small}>
              O aluno permanece na turma atual até a vigência. A revisão mostra incompatibilidades
              antes da confirmação.
            </p>
          </>
        )}
        <NarrativeField
          name="movement-reason"
          label={decline ? "Motivo" : "Motivo · opcional"}
          value={reason}
          onChange={setReason}
          placeholder="Horário, adaptação ou outro combinado"
          rows={2}
          error={validation.errors.reason}
        />
      </form>
    </TaskDialog>
  );
}

function FindStudent({
  board,
  onClose,
  onAction,
}: Pick<Props, "board" | "onClose" | "onAction">): ReactJSX.Element {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const query = trpc.semesterOrganization.students.useQuery({
    semesterId: board.semester.id,
    search,
    page,
    unassigned: true,
  });
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title="Incluir aluno na organização"
      description={`Alunos cadastrados sem proposta em ${board.semester.name}.`}
      formId="organization-find"
      firstField="organization-student-search"
      submitLabel="Cadastrar novo aluno"
      pending={false}
      onClose={onClose}
      error={query.error?.message}
    >
      <form
        id="organization-find"
        className={s.form}
        onSubmit={(event) => {
          event.preventDefault();
          onAction({ kind: "student" });
        }}
      >
        <Input
          id="organization-student-search"
          size="sm"
          placeholder="Buscar por nome"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          aria-label="Buscar aluno"
        />
        <div className="min-h-48 max-h-80 overflow-auto" aria-busy={query.isFetching}>
          {query.isPending ? (
            <p className={s.small}>Carregando alunos…</p>
          ) : (
            query.data?.rows.map((student) => (
              <button
                type="button"
                className={s.queueItem}
                key={student.id}
                onClick={() => onAction({ kind: "placement", studentId: student.id })}
              >
                <span className={s.person}>
                  <strong>{student.name}</strong>
                  <span className={s.small}>
                    {student.current
                      .map((current) => `${current.stageCode} · ${current.className}`)
                      .join(" / ") || "Sem turma atual"}
                  </span>
                </span>
                <span className="text-caption text-interactive">Incluir</span>
              </button>
            ))
          )}
          {query.data?.rows.length === 0 && (
            <p className={s.small}>Nenhum aluno encontrado. Você pode cadastrar um novo.</p>
          )}
        </div>
        {query.data && query.data.total > 25 && (
          <div className={s.row}>
            <Button
              size="sm"
              variant="ghost"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <span className={s.small}>Página {page}</span>
            <Button
              size="sm"
              variant="ghost"
              disabled={page * 25 >= query.data.total}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </Button>
          </div>
        )}
      </form>
    </TaskDialog>
  );
}
