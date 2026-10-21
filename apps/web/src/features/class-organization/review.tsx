"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, History } from "lucide-react";
import {
  Button,
  Checkbox,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import {
  dateOnly,
  scheduleLabel,
  useOrganizationRefresh,
} from "~/features/semester-organization/shared";
import {
  changeLabel,
  contractLabel,
  type OrganizationAction,
  type Placement,
  type SemesterBoard,
} from "./model";
import s from "./organization.module.css";

export function OrganizationReview({
  board,
  query,
  onAction,
  onFeedback,
}: {
  board: SemesterBoard;
  query: string;
  onAction: (action: OrganizationAction) => void;
  onFeedback: (text: string) => void;
}): ReactJSX.Element {
  const [ids, setIds] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publish = trpc.semesterOrganization.publish.useMutation();
  const refresh = useOrganizationRefresh();
  const rows = board.placements.filter(
    (row) =>
      (showAll || !row.publishedAt) &&
      row.studentName.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")),
  );
  const eligible = rows.filter(
    (row) => !row.publishedAt && !row.declinedAt && row.blockers.length === 0 && row.planId,
  );
  const selected = eligible.filter((row) => ids.includes(row.id));
  async function confirm(): Promise<void> {
    if (working || selected.length === 0) return;
    setWorking(true);
    setError(null);
    let count = 0;
    try {
      for (const plan of board.plans) {
        const placements = selected
          .filter((row) => row.planId === plan.id)
          .map(({ id, version }) => ({ id, version }));
        if (placements.length === 0) continue;
        const result = await publish.mutateAsync({
          planId: plan.id,
          version: plan.version,
          placements,
        });
        count += result.count;
      }
      setIds([]);
      onFeedback(
        `${count} ${count === 1 ? "alocação confirmada" : "alocações confirmadas"}. Cada vínculo respeita sua data de vigência.`,
      );
    } catch (error_) {
      setError(
        `${count ? `${count} alocações foram confirmadas. ` : ""}${error_ instanceof Error ? error_.message : "Não foi possível concluir. Atualize e tente novamente."}`,
      );
    } finally {
      await refresh();
      setWorking(false);
    }
  }
  return (
    <section className={s.review} aria-label="Revisão das mudanças">
      <div className={s.row}>
        <div>
          <h2 className="text-body font-semibold">Antes de confirmar</h2>
          <p className={s.small}>
            Compare origem e destino. Passe sobre a mudança ou abra os detalhes.
          </p>
        </div>
        <label className={s.rowStart}>
          <Checkbox
            size="sm"
            checked={showAll}
            onCheckedChange={(value) => setShowAll(Boolean(value))}
          />
          <span className={s.small}>Incluir confirmados</span>
        </label>
      </div>
      {error && (
        <div role="alert" className={s.error}>
          {error}
        </div>
      )}
      <div className={s.reviewTable}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>
                <Checkbox
                  size="sm"
                  aria-label="Selecionar alocações prontas"
                  disabled={eligible.length === 0 || working}
                  checked={eligible.length > 0 && selected.length === eligible.length}
                  indeterminate={selected.length > 0 && selected.length < eligible.length}
                  onCheckedChange={(value) => setIds(value ? eligible.map((row) => row.id) : [])}
                />
              </th>
              <th>Aluno / mudança</th>
              <th>Origem</th>
              <th>Destino</th>
              <th>Vigência</th>
              <th>Pendências / contrato</th>
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const plan = board.plans.find((item) => item.id === row.planId);
              const contract = contractLabel(row);
              return (
                <tr key={row.id}>
                  <td>
                    <Checkbox
                      size="sm"
                      aria-label={`Confirmar ${row.studentName}`}
                      checked={ids.includes(row.id)}
                      disabled={working || !eligible.some((item) => item.id === row.id)}
                      onCheckedChange={(value) =>
                        setIds((previous) =>
                          value ? [...previous, row.id] : previous.filter((id) => id !== row.id),
                        )
                      }
                    />
                  </td>
                  <td>
                    <div className={s.person}>
                      <Link href={`/alunos/${row.studentId}`}>
                        <strong>{row.studentName}</strong>
                      </Link>
                      <DiffDetails row={row} board={board} />
                    </div>
                  </td>
                  <td>
                    <div className={s.origin}>
                      <span>{row.sourceClassName ?? "Sem vínculo anterior"}</span>
                      <span className={s.small}>{row.sourceStageCode ?? "Nova entrada"}</span>
                      <span className={s.small}>{scheduleLabel(row.sourceSchedule) || "—"}</span>
                      <span className={s.small}>{row.sourceTeacher ?? "—"}</span>
                    </div>
                  </td>
                  <td>
                    <div className={s.destination}>
                      <span
                        className={
                          changeLabel(row, board) === "Transferência" ? s.changed : undefined
                        }
                      >
                        {row.declinedAt ? "Não continuará" : (plan?.name ?? "Turma a definir")}
                      </span>
                      <span className={row.stageId === row.sourceStageId ? s.small : s.changed}>
                        {row.stageCode ?? "Estágio a definir"}
                      </span>
                      <span className={s.small}>{plan ? scheduleLabel(plan.slots) : "—"}</span>
                      <span className={s.small}>{plan?.teacherName ?? "Professor a definir"}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap">
                    <div className={s.person}>
                      <span>
                        {formatDateOnlyBR(dateOnly(row.effectiveDate ?? board.semester.startDate))}
                      </span>
                      <span className={s.small}>
                        {row.declinedAt
                          ? "Registrada"
                          : row.publishedAt
                            ? "Confirmada"
                            : "A confirmar"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className={s.person}>
                      {row.blockers.slice(0, 2).map((blocker) => (
                        <span key={blocker} className={`${s.small} ${s.attention}`}>
                          {blocker}
                        </span>
                      ))}
                      {row.blockers.length > 2 && (
                        <span className={s.small}>+{row.blockers.length - 2} nos detalhes</span>
                      )}
                      {row.blockers.length === 0 && !row.declinedAt && (
                        <span className={s.small}>
                          <Check size={12} className="inline" />
                          {row.publishedAt ? "Alocação confirmada" : "Alocação pronta"}
                        </span>
                      )}
                      {contract.warning && row.lastContract ? (
                        <button
                          type="button"
                          className={`${s.small} ${s.attention} text-left underline underline-offset-4`}
                          onClick={() =>
                            onAction({ kind: "renew", contractId: row.lastContract!.id })
                          }
                        >
                          {contract.label} · renovar
                        </button>
                      ) : (
                        <Link
                          href={`/alunos/${row.studentId}?secao=financeiro`}
                          className={`${s.small} ${contract.warning ? s.attention : ""}`}
                        >
                          {contract.label}
                        </Link>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className={s.actions}>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={working}
                        onClick={() =>
                          onAction(
                            row.publishedAt
                              ? { kind: "move", rows: [row] }
                              : { kind: "placement", studentId: row.studentId, row },
                          )
                        }
                      >
                        Revisar
                      </Button>
                      {row.entryStatus === "SCHEDULED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={working}
                          onClick={() => onAction({ kind: "withdraw", row })}
                        >
                          Desfazer
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Histórico de ${row.studentName}`}
                        onClick={() => onAction({ kind: "history", row })}
                      >
                        <History size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className={s.empty}>
            <h2>Nenhuma mudança nesta seleção</h2>
            <p>
              Inclua os confirmados para consultar a composição ou organize novos alunos pela
              agenda.
            </p>
          </div>
        )}
      </div>
      <footer className={s.selection}>
        <span className={s.small}>
          {selected.length} selecionados · {eligible.length} prontos para confirmar
        </span>
        <span className={`${s.small} ${s.push}`}>Contratos são tratados separadamente.</span>
        <Button
          size="sm"
          disabled={selected.length === 0 || working}
          onClick={() => void confirm()}
        >
          {working
            ? "Confirmando alocações…"
            : `Confirmar${selected.length > 0 ? ` ${selected.length}` : " selecionados"}`}
        </Button>
      </footer>
    </section>
  );
}

function DiffDetails({ row, board }: { row: Placement; board: SemesterBoard }): ReactJSX.Element {
  const plan = board.plans.find((item) => item.id === row.planId);
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={300}
        className="text-micro text-interactive text-left underline underline-offset-4"
      >
        {changeLabel(row, board)} · detalhes
      </PopoverTrigger>
      <PopoverContent size="lg">
        <PopoverTitle>{row.studentName}</PopoverTitle>
        <div className={`${s.diffDetails} mt-3`}>
          {[
            ["Turma", row.sourceClassName ?? "Sem turma", plan?.name ?? "A definir"],
            ["Estágio", row.sourceStageCode ?? "—", row.stageCode ?? "A definir"],
            [
              "Horário",
              scheduleLabel(row.sourceSchedule) || "—",
              plan ? scheduleLabel(plan.slots) : "A definir",
            ],
            ["Professor", row.sourceTeacher ?? "—", plan?.teacherName ?? "A definir"],
          ].map(([label, before, after]) => (
            <div key={label}>
              <span className={s.small}>{label}</span>
              <div className={s.diffLine}>
                <span className={s.origin}>{before}</span>
                <ArrowRight size={12} />
                <span className={before === after ? undefined : s.changed}>{after}</span>
              </div>
            </div>
          ))}
          <p>
            Válida a partir de{" "}
            {formatDateOnlyBR(dateOnly(row.effectiveDate ?? board.semester.startDate))}.
          </p>
          {row.notes && <p className={s.small}>{row.notes}</p>}
          {row.blockers.map((blocker) => (
            <p key={blocker} className={s.attention}>
              {blocker}
            </p>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
