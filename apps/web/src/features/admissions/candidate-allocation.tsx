"use client";
import { useState, type ReactElement } from "react";
import { ArrowRight, Check, Search } from "lucide-react";
import { Alert, Badge, Button, InlineSkeleton, cn } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { TextControl } from "~/features/classes/form-controls";
import { dateLabel, dateOnly, dayLabel, type Candidate } from "./labels";
import { EnrollDialog } from "./enroll-dialog";

export function CandidateAllocation({
  candidate,
  onEdit,
}: {
  candidate: Candidate;
  onEdit: () => void;
}): ReactElement {
  const [date, setDate] = useState(dateLabel(candidate.today));
  const parsed = parseDateBR(date);
  const [selected, setSelected] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const enabled = Boolean(
    parsed &&
    candidate.stageId &&
    dateOnly(candidate.availableUntil) >= (parsed ?? candidate.today),
  );
  const query = trpc.admissions.matches.useQuery(
    { id: candidate.id, date: parsed ?? candidate.today },
    { enabled, retry: false },
  );
  const choice = query.data?.find((row) => row.id === selected);
  return (
    <section
      className="grid gap-5 rounded-lg border border-border bg-card p-4 sm:p-5"
      aria-label="Encontrar turma"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="font-display text-h3 font-semibold">Encontre a turma certa</h2>
          <p className="text-caption text-muted-foreground">
            Estágio, formato e todos os horários compatíveis.
          </p>
        </div>
        <div className="w-36">
          <TextControl
            name="allocation-date"
            label="Entrada a partir de"
            placeholder="dd/mm/aaaa"
            inputMode="numeric"
            value={date}
            onChange={(value) => {
              setDate(maskDateBR(value));
              setSelected("");
            }}
            error={date && !parsed ? "Data inválida." : undefined}
          />
        </div>
      </div>
      {!candidate.stageId ? (
        <div className="grid justify-items-start gap-3 border-t border-border pt-4">
          <p className="text-caption text-muted-foreground">
            Registre o estágio indicado pelo nivelamento para encontrar turmas compatíveis.
          </p>
          <Button variant="secondary" size="sm" onClick={onEdit}>
            Informar estágio
          </Button>
        </div>
      ) : !enabled ? (
        <p className="text-caption text-muted-foreground">
          Informe uma data coberta pela disponibilidade confirmada.
        </p>
      ) : query.isError ? (
        <Alert variant="destructive">{query.error.message}</Alert>
      ) : !query.data ? (
        <InlineSkeleton className="h-24 w-full" />
      ) : query.data.length === 0 ? (
        <div className="flex gap-3 border-t border-border py-5">
          <Search className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="grid gap-1">
            <p className="font-medium">Nenhuma turma compatível por enquanto</p>
            <p className="text-caption text-muted-foreground">
              O interesse continua registrado. Revise os horários ou consulte novamente após a
              abertura de novas turmas.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div role="radiogroup" aria-label="Turmas compatíveis" className="grid gap-2">
            {query.data.map((row) => (
              <button
                type="button"
                key={row.id}
                role="radio"
                aria-checked={selected === row.id}
                tabIndex={
                  selected === row.id || (!selected && row.id === query.data?.[0]?.id) ? 0 : -1
                }
                onKeyDown={(event) => {
                  if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key))
                    return;
                  event.preventDefault();
                  const choices = query.data ?? [];
                  const direction =
                    event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
                  const next =
                    choices[
                      (choices.findIndex((item) => item.id === row.id) +
                        direction +
                        choices.length) %
                        choices.length
                    ];
                  if (next) {
                    setSelected(next.id);
                    event.currentTarget.parentElement
                      ?.querySelector<HTMLButtonElement>(`[data-class-id="${next.id}"]`)
                      ?.focus();
                  }
                }}
                data-class-id={row.id}
                onClick={() => setSelected(row.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected === row.id ? "border-primary bg-accent" : "border-border hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                    selected === row.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border-strong",
                  )}
                >
                  {selected === row.id && <Check className="size-3" />}
                </span>
                <span className="grid min-w-0 flex-1 gap-1">
                  <span className="break-words font-medium">{row.name}</span>
                  <span className="text-caption text-muted-foreground">
                    {row.slots
                      .map((slot) => `${dayLabel(slot.weekday)} ${slot.startTime}–${slot.endTime}`)
                      .join(" · ")}
                  </span>
                  <span className="text-caption text-muted-foreground">{row.semester}</span>
                </span>
                <Badge variant={row.enrolled >= row.capacity ? "warning" : "neutral"}>
                  {row.enrolled}/{row.capacity}
                </Badge>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-caption text-muted-foreground">
              Capacidade de referência. A matrícula não gera cobranças.
            </p>
            <Button
              size="compact-responsive"
              disabled={!choice || query.isFetching}
              onClick={() => setEnrolling(true)}
            >
              Matricular
              <ArrowRight />
            </Button>
          </div>
        </>
      )}
      {enrolling && choice && parsed && (
        <EnrollDialog
          candidate={candidate}
          choice={choice}
          date={parsed}
          onClose={() => setEnrolling(false)}
        />
      )}
    </section>
  );
}
