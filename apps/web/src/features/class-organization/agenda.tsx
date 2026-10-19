"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, History, Plus } from "lucide-react";
import { Button, Checkbox } from "@lazuli/ui";
import { dateOnly, scheduleLabel } from "~/features/semester-organization/shared";
import {
  contractLabel,
  rowsFor,
  suggestedPlans,
  type ClassPlan,
  type OrganizationAction,
  type SemesterBoard,
} from "./model";
import s from "./organization.module.css";
import { WeeklySchedule } from "./weekly-schedule";

type Props = {
  board: SemesterBoard;
  query: string;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onAction: (action: OrganizationAction) => void;
};
export function OrganizationAgenda({ board, query, selected, onSelect, onAction }: Props) {
  const plan = board.plans.find((item) => item.id === selected);
  const [mobilePanel, setMobilePanel] = useState(false);
  const selectPlan = (id: string | null) => {
    onSelect(id);
    setMobilePanel(true);
  };
  const pending =
    board.intents.length +
    board.placements.filter(
      (row) => !row.declinedAt && (!row.planId || (!row.publishedAt && row.blockers.length)),
    ).length;
  return (
    <div className={`${s.workspace} ${s.agendaWorkspace}`} data-panel={mobilePanel}>
      <div className={s.mobileContext}>
        <Button
          size="sm"
          variant={!mobilePanel ? "secondary" : "ghost"}
          aria-pressed={!mobilePanel}
          onClick={() => setMobilePanel(false)}
        >
          Horários
        </Button>
        <Button
          size="sm"
          variant={mobilePanel ? "secondary" : "ghost"}
          aria-pressed={mobilePanel}
          onClick={() => setMobilePanel(true)}
        >
          {plan ? "Alunos da turma" : `A acomodar · ${pending}`}
        </Button>
      </div>
      <div className={s.agenda}>
        <div className={s.agendaTop}>
          <span>Horários das turmas · {board.semester.name}</span>
          <span className={s.small}>Selecione uma turma para organizar os alunos</span>
        </div>
        <div className={s.calendar}>
          <WeeklySchedule board={board} query={query} selected={selected} onSelect={selectPlan} />
        </div>
      </div>
      {plan ? (
        <Composition
          key={plan.id}
          plan={plan}
          board={board}
          onBack={() => selectPlan(null)}
          onAction={onAction}
        />
      ) : (
        <AccommodationQueue board={board} onAction={onAction} onSelect={selectPlan} />
      )}
    </div>
  );
}

function Composition({
  plan,
  board,
  onBack,
  onAction,
}: {
  plan: ClassPlan;
  board: SemesterBoard;
  onBack: () => void;
  onAction: Props["onAction"];
}) {
  const rows = rowsFor(board, plan.id);
  const [ids, setIds] = useState<string[]>([]);
  const selected = rows.filter((row) => ids.includes(row.id));
  const future =
    dateOnly(board.semester.startDate) >
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return (
    <aside className={s.panel} aria-label={`Composição de ${plan.name}`}>
      <header className={s.panelHeader}>
        <div className={s.row}>
          <Button size="sm" variant="ghost" onClick={onBack}>
            <ArrowLeft size={14} />A acomodar
          </Button>
          <span className={s.small}>{rows.length} alunos</span>
        </div>
        <h2>{plan.name}</h2>
        <span className={s.small}>
          {scheduleLabel(plan.slots)} · {plan.teacherName ?? "Professor a definir"}
        </span>
        <div className={s.actions}>
          {plan.classId ? (
            <Link
              className="text-caption text-interactive underline"
              href={`/turmas/${plan.classId}`}
            >
              Gerenciar turma e professor
            </Link>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => onAction({ kind: "plan", plan })}>
              Editar turma
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onAction({ kind: "findStudent" })}>
            <Plus size={14} />
            Aluno
          </Button>
        </div>
      </header>
      {rows.length < 4 && (
        <div className={s.note}>
          Menos de 4 alunos. Considere reunir horários compatíveis ou captar novos interessados.
        </div>
      )}
      <div className={s.scroll}>
        {rows.map((row) => (
          <div className={s.personRow} key={row.id}>
            <Checkbox
              size="sm"
              aria-label={`Selecionar ${row.studentName}`}
              checked={ids.includes(row.id)}
              onCheckedChange={(checked) =>
                setIds((previous) =>
                  checked ? [...previous, row.id] : previous.filter((id) => id !== row.id),
                )
              }
            />
            <button
              type="button"
              className={`${s.person} text-left flex-1`}
              onClick={() =>
                onAction(
                  row.publishedAt
                    ? { kind: "move", rows: [row] }
                    : { kind: "placement", studentId: row.studentId, row },
                )
              }
            >
              <strong>{row.studentName}</strong>
              <span className={s.small}>
                {row.stageCode ?? "Estágio a definir"} ·{" "}
                {row.publishedAt
                  ? "Confirmado"
                  : row.blockers.length
                    ? "Revisar pendências"
                    : "A confirmar"}
              </span>
              <span className={`${s.small} ${contractLabel(row).warning ? s.attention : ""}`}>
                {contractLabel(row).label}
              </span>
            </button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Histórico de ${row.studentName}`}
              onClick={() => onAction({ kind: "history", row })}
            >
              <History size={14} />
            </Button>
          </div>
        ))}
        {!rows.length && (
          <div className={s.empty}>
            <p>
              Este horário ainda não tem alunos. Acomode alguém da fila ou registre uma nova
              entrada.
            </p>
            <Button size="sm" variant="secondary" onClick={onBack}>
              Ver alunos a acomodar
            </Button>
          </div>
        )}
      </div>
      <footer className={s.selection}>
        <span className={s.small}>
          {selected.length ? `${selected.length} selecionados` : "Selecione alunos para movimentar"}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={!selected.length}
          onClick={() => onAction({ kind: "move", rows: selected })}
        >
          Transferir
        </Button>
        {future && (
          <Button
            size="sm"
            variant="ghost"
            disabled={!selected.length}
            onClick={() => onAction({ kind: "decline", rows: selected })}
          >
            Não continuarão
          </Button>
        )}
      </footer>
    </aside>
  );
}

function AccommodationQueue({
  board,
  onAction,
  onSelect,
}: {
  board: SemesterBoard;
  onAction: Props["onAction"];
  onSelect: Props["onSelect"];
}) {
  const queue = board.placements.filter(
    (row) => !row.declinedAt && (!row.planId || (!row.publishedAt && row.blockers.length > 0)),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const row = queue.find((item) => item.id === selected) ?? queue[0];
  const suggestions = row ? suggestedPlans(row, board) : [];
  return (
    <aside className={s.panel} aria-label="Alunos a acomodar">
      <header className={s.panelHeader}>
        <div className={s.row}>
          <h2>
            A acomodar <span className={s.small}>{queue.length + board.intents.length}</span>
          </h2>
          <Button size="sm" variant="secondary" onClick={() => onAction({ kind: "findStudent" })}>
            <Plus size={14} />
            Aluno
          </Button>
        </div>
        <p className={s.small}>Disponibilidade, turma e pendências no mesmo lugar.</p>
      </header>
      {queue.length || board.intents.length ? (
        <>
          <div className={s.queue}>
            {board.intents.map((intent) => (
              <button
                type="button"
                key={intent.id}
                className={s.queueItem}
                onClick={() => onAction({ kind: "placement", studentId: intent.studentId })}
              >
                <span className={s.person}>
                  <strong>{intent.studentName}</strong>
                  <span className={s.small}>
                    Definir estágio e turma ·{" "}
                    {intent.slots.length ? scheduleLabel(intent.slots) : "Horários a combinar"}
                  </span>
                </span>
                <ArrowRight size={14} />
              </button>
            ))}
            {queue.map((item) => (
              <button
                type="button"
                key={item.id}
                className={s.queueItem}
                aria-pressed={row?.id === item.id}
                onClick={() => setSelected(item.id)}
              >
                <span className={s.person}>
                  <strong>{item.studentName}</strong>
                  <span className={s.small}>
                    {item.stageCode ?? "Estágio a definir"} ·{" "}
                    {item.planId ? "Revisar proposta" : "Sem turma"}
                  </span>
                </span>
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
          {row && (
            <div className={`${s.scroll} ${s.detail}`}>
              <div className={s.row}>
                <strong>{row.studentName}</strong>
                <Link
                  className="text-caption text-interactive underline"
                  href={`/alunos/${row.studentId}`}
                >
                  Perfil
                </Link>
              </div>
              <dl className={s.facts}>
                <dt>Origem</dt>
                <dd>{row.sourceClassName ?? "Nova matrícula"}</dd>
                <dt>Horários</dt>
                <dd>
                  {row.availability?.slots.length
                    ? scheduleLabel(row.availability.slots)
                    : "Ainda não informados"}
                </dd>
                <dt>Contrato</dt>
                <dd className={contractLabel(row).warning ? s.attention : undefined}>
                  {contractLabel(row).label}
                </dd>
              </dl>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onAction({ kind: "availability", studentId: row.studentId })}
              >
                Ajustar disponibilidade
              </Button>
              {contractLabel(row).warning && row.lastContract && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onAction({ kind: "renew", contractId: row.lastContract!.id })}
                >
                  Renovar contrato com os mesmos termos
                </Button>
              )}
              {row.blockers.length > 0 && (
                <div className={s.summary}>
                  <strong>O que falta resolver</strong>
                  {row.blockers.map((blocker) => (
                    <span key={blocker}>{blocker}</span>
                  ))}
                </div>
              )}
              <div>
                <h3 className="text-caption font-semibold mb-2">
                  {suggestions.length ? "Turmas compatíveis" : "Sem turma compatível por enquanto"}
                </h3>
                {suggestions.map((plan) => (
                  <div key={plan.id} className={`${s.suggestion} mb-2`}>
                    <strong>
                      {plan.name}
                      {plan.sourceClassId === row.sourceClassId ? " · turma de origem" : ""}
                    </strong>
                    <span className={s.small}>
                      {scheduleLabel(plan.slots)} · {rowsFor(board, plan.id).length} alunos
                    </span>
                    <div className={s.actions}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          onAction({
                            kind: "placement",
                            studentId: row.studentId,
                            row,
                            planId: plan.id,
                          })
                        }
                      >
                        Propor alocação
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onSelect(plan.id)}>
                        Ver turma
                      </Button>
                    </div>
                  </div>
                ))}
                {!suggestions.length && (
                  <p className={s.small}>
                    Registre os horários combinados. Se nenhuma turma atender, a pendência permanece
                    visível para formar um novo horário.
                  </p>
                )}
              </div>
            </div>
          )}
          {row && (
            <footer className={s.selection}>
              <Button
                size="sm"
                onClick={() => onAction({ kind: "placement", studentId: row.studentId, row })}
              >
                Revisar alocação e estágio
              </Button>
            </footer>
          )}
          {!row && (
            <div className={`${s.scroll} ${s.detail}`}>
              <p className={s.small}>
                Selecione um aluno para definir seu estágio. A disponibilidade já registrada será
                aproveitada na sugestão de turma.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className={`${s.scroll} ${s.detail}`}>
          <div className={s.summary}>
            <strong>Nenhuma pendência de acomodação</strong>
            <span>Novos alunos e mudanças de disponibilidade aparecerão aqui.</span>
          </div>
          {board.plans.some((plan) => rowsFor(board, plan.id).length < 4) && (
            <h3 className="text-caption font-semibold">Turmas com atenção operacional</h3>
          )}
          {board.plans
            .filter((plan) => rowsFor(board, plan.id).length < 4)
            .map((plan) => (
              <button
                type="button"
                className={s.queueItem}
                key={plan.id}
                onClick={() => onSelect(plan.id)}
              >
                <span className={s.person}>
                  <strong>{plan.name}</strong>
                  <span className={s.small}>{scheduleLabel(plan.slots)}</span>
                </span>
                <span className={s.attention}>{rowsFor(board, plan.id).length}/4</span>
              </button>
            ))}
          <h3 className="text-caption font-semibold">Contratos a revisar</h3>
          <div>
            {board.placements
              .filter((item) => !item.declinedAt && contractLabel(item).warning)
              .slice(0, 20)
              .map((item) => (
                <div key={item.id} className={s.personRow}>
                  <span className={`${s.person} flex-1`}>
                    <strong>{item.studentName}</strong>
                    <span className={`${s.small} ${s.attention}`}>{contractLabel(item).label}</span>
                  </span>
                  {item.lastContract ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onAction({ kind: "renew", contractId: item.lastContract!.id })}
                    >
                      Renovar
                    </Button>
                  ) : (
                    <Link
                      className="text-caption text-interactive"
                      href={`/alunos/${item.studentId}?secao=financeiro`}
                    >
                      Financeiro
                    </Link>
                  )}
                </div>
              ))}
          </div>
          <Button size="sm" variant="secondary" onClick={() => onAction({ kind: "student" })}>
            Cadastrar aluno
          </Button>
        </div>
      )}
    </aside>
  );
}
