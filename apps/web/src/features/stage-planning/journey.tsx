"use client";
import { useState, type ReactElement } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  Clock3,
  Info,
  Plus,
} from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from "@lazuli/ui";
import { SelectControl } from "~/features/classes/form-controls";
import { dateLabel, type Planning, type PlannedItem } from "./shared";
import { semesterOutlook, contentGroups, type ContentGroup } from "./outlook-model";
import styles from "./journey.module.css";
import { contentChoicesForUnit } from "./journey-model";

const MINUTES_PER_HOUR = 60;
const hours = (minutes: number): string =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(minutes / MINUTES_PER_HOUR)}h`;
type Outlook = ReturnType<typeof semesterOutlook>;
const STATES = {
  completed: { label: "Concluído", variant: "success" },
  partial: { label: "Em andamento", variant: "warning" },
  worked: { label: "Conclusão não informada", variant: "info" },
  unconfirmed: { label: "Ainda sem conclusão", variant: "neutral" },
  scheduled: { label: "A trabalhar", variant: "neutral" },
} as const;
export function PlanningJourney({
  data,
  onEdit,
}: {
  data: Planning;
  onEdit?: ((item: PlannedItem | null) => void) | undefined;
}): ReactElement {
  const outlook = semesterOutlook(data);
  const groups = contentGroups(outlook.journey);
  const [selected, setSelected] = useState<string | null>(null);
  const current = groups.find((group) =>
    group.steps.some((step) => step.item.id === outlook.journey.current?.item.id),
  );
  const next = groups.find((group) =>
    group.steps.some((step) => step.item.id === outlook.journey.next?.item.id),
  );
  const previous = groups
    .slice(0, current ? groups.indexOf(current) : 0)
    .findLast((group) => group.steps.every((step) => step.state === "completed"));
  return (
    <div className={styles.workspace}>
      <SemesterSummary data={data} outlook={outlook} />
      <JourneyContent
        data={data}
        outlook={outlook}
        groups={groups}
        current={current}
        next={next}
        previous={previous}
        setSelected={setSelected}
        onEdit={onEdit}
      />
      {selected && (
        <ContentExplorer
          groups={groups}
          selected={selected}
          onSelect={setSelected}
          onClose={() => setSelected(null)}
          onEdit={onEdit}
          preview={Boolean(data.preview)}
        />
      )}
    </div>
  );
}

function outlookCopy(outlook: Outlook): {
  title: string;
  explanation: string;
  label: string;
  variant: "success" | "warning" | "neutral" | "info";
} {
  if (outlook.status === "unknown")
    return {
      title: "Ainda falta confirmar o avanço da turma",
      label: "Dados incompletos",
      variant: "neutral",
      explanation: outlook.unknownDurations
        ? "A programação não informa a duração de todos os conteúdos. Não é possível comparar a carga restante com o calendário."
        : "Há aulas ou conteúdos anteriores sem cobertura confirmada. Confira os registros antes de avaliar a folga do semestre.",
    };
  if (outlook.status === "complete")
    return {
      title: "Programação concluída",
      label: "Concluída",
      variant: "success",
      explanation:
        "Todos os conteúdos têm conclusão registrada. O tempo disponível pode apoiar revisões e consolidação.",
    };
  if (outlook.status === "partial")
    return {
      title: "Há conteúdo em andamento a confirmar",
      label: "Estimativa conservadora",
      variant: "info",
      explanation:
        "A carga abaixo inclui o tempo integral das atividades parciais. A folga pode aumentar quando a conclusão for registrada.",
    };
  if (outlook.status === "shortfall")
    return {
      title: `Faltam ${hours(-outlook.margin)} de aula para acomodar o conteúdo`,
      label: "Exige ajuste",
      variant: "warning",
      explanation:
        "A carga prevista restante supera o tempo disponível. Revise a distribuição do conteúdo ou a possibilidade de aulas adicionais antes do encerramento.",
    };
  if (outlook.status === "tight")
    return {
      title: "O conteúdo cabe, mas não há folga",
      label: "Sem margem",
      variant: "warning",
      explanation:
        "Todo o tempo restante está comprometido. Novas interrupções ou conteúdos que precisem de mais tempo exigirão ajuste.",
    };
  return {
    title: `Há ${hours(outlook.margin)} de folga para concluir o conteúdo`,
    label: "Cabe no semestre",
    variant: "success",
    explanation:
      "A carga prevista restante cabe nas aulas disponíveis. A folga permite retomar conteúdos e acomodar ajustes de ritmo.",
  };
}
function SemesterSummary({ data, outlook }: { data: Planning; outlook: Outlook }): ReactElement {
  const copy = outlookCopy(outlook);
  const max = Math.max(1, outlook.availableMinutes, outlook.remainingMinutes);
  return (
    <section className={styles.outlook} aria-label="Conclusão do conteúdo no semestre">
      <header className={styles.outlookHeader}>
        <div className={styles.outlookStatus}>
          <h3>Até o fim do semestre</h3>
          <Badge variant={copy.variant}>{copy.label}</Badge>
        </div>
        <span>
          <CalendarDays size={15} aria-hidden="true" />
          {dateLabel(data.scope.semester.endOn)}
        </span>
      </header>
      <div className={styles.outlookBody}>
        <div className={styles.conclusion}>
          <h2>{copy.title}</h2>
          <p>{copy.explanation}</p>
        </div>
        <div className={styles.comparison}>
          <div className={styles.measure}>
            <div>
              <span>{data.preview ? "Carga da programação" : "Conteúdo restante"}</span>
              <strong>
                {outlook.status === "unknown"
                  ? "A confirmar"
                  : `${outlook.partialMinutes ? "Até " : ""}${hours(outlook.remainingMinutes)}`}
              </strong>
            </div>
            {outlook.status !== "unknown" && (
              <meter
                min={0}
                max={max}
                value={outlook.remainingMinutes}
                aria-label={`Carga prevista do conteúdo restante: ${hours(outlook.remainingMinutes)}`}
                className={styles.meter}
              />
            )}
          </div>
          <div className={styles.measure}>
            <div>
              <span>Aulas disponíveis</span>
              <strong>{hours(outlook.availableMinutes)}</strong>
            </div>
            <meter
              min={0}
              max={max}
              value={outlook.availableMinutes}
              aria-label={`Tempo de aula disponível: ${hours(outlook.availableMinutes)}`}
              className={styles.meter}
              data-calendar
            />
          </div>
          <p>
            {data.calendar.remainingSessions}{" "}
            {data.calendar.remainingSessions === 1 ? "encontro previsto" : "encontros previstos"}{" "}
            até o encerramento.
          </p>
        </div>
      </div>
      <SummaryMethod data={data} />
    </section>
  );
}

function ContentMoment({
  label,
  group,
  detail,
  empty,
  current,
  onOpen,
}: {
  label: string;
  group: ContentGroup | undefined;
  detail: string | null;
  empty: string;
  current?: boolean;
  onOpen: (id: string) => void;
}): ReactElement {
  return (
    <div className={styles.moment} data-current={current || undefined}>
      <h4>
        {momentIcon(current, label)}
        {label}
      </h4>
      {group ? (
        <>
          <button type="button" className={styles.contentLink} onClick={() => onOpen(group.id)}>
            {group.unit} · {group.title}
            <ArrowUpRight size={15} aria-hidden="true" />
          </button>
          <p>{detail}</p>
        </>
      ) : (
        <p>{empty}</p>
      )}
    </div>
  );
}

function ContentExplorer({
  groups,
  selected,
  onSelect,
  onClose,
  onEdit,
  preview,
}: {
  groups: ContentGroup[];
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  onEdit?: ((item: PlannedItem) => void) | undefined;
  preview: boolean;
}): ReactElement {
  const group = groups.find((group) => group.id === selected) ?? groups[0];
  if (!group) return <></>;
  const units = [...new Set(groups.map((group) => group.unit))];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="md:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Programação por conteúdo</DialogTitle>
            <DialogDescription>
              Consulte o previsto e o que foi trabalhado em cada lição.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className={styles.explorer}>
              <div className={styles.selectors}>
                <SelectControl
                  name="planning-unit"
                  label="Unidade"
                  value={group.unit}
                  choices={units.map((unit) => ({ value: unit, label: unit }))}
                  onChange={(unit) => {
                    const first = groups.find((group) => group.unit === unit);
                    if (first) onSelect(first.id);
                  }}
                />
                <SelectControl
                  name="planning-content"
                  label="Conteúdo"
                  value={group.id}
                  choices={contentChoicesForUnit(groups, group.unit)}
                  onChange={onSelect}
                />
              </div>
              <ExplorerActivities
                group={group}
                preview={preview}
                onEdit={onEdit}
                onClose={onClose}
              />
            </div>
          </DialogBody>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function JourneyContent({
  data,
  outlook,
  groups,
  current,
  next,
  previous,
  setSelected,
  onEdit,
}: {
  data: Planning;
  outlook: Outlook;
  groups: ContentGroup[];
  current: ContentGroup | undefined;
  next: ContentGroup | undefined;
  previous: ContentGroup | undefined;
  setSelected: (value: string) => void;
  onEdit: ((item: PlannedItem | null) => void) | undefined;
}): ReactElement {
  return (
    <section className={styles.content} aria-label="Percurso do conteúdo">
      <div className={styles.contentHeader}>
        <h3>
          <BookOpen size={18} aria-hidden="true" />
          Conteúdo da turma
        </h3>
        {groups.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(current?.id ?? groups[0]!.id)}
          >
            Explorar programação
            <ArrowRight aria-hidden="true" />
          </Button>
        )}
      </div>
      <JourneyMoments
        outlook={outlook}
        current={current}
        next={next}
        previous={previous}
        setSelected={setSelected}
      />
      <p className={styles.contextLine}>
        {journeyContext(data, outlook)}
        {!data.preview &&
          outlook.journey.expected &&
          ` Pelo roteiro, até hoje estava previsto: ${outlook.journey.expected.item.title}.`}
      </p>
      {onEdit && (
        <Button variant="ghost" size="sm" onClick={() => onEdit(null)}>
          <Plus aria-hidden="true" />
          Adicionar atividade
        </Button>
      )}
    </section>
  );
}

function journeyContext(data: Planning, outlook: Outlook): string {
  if (data.preview)
    return "Prévia da programação. Os conteúdos sem data precisam de tempo adicional no calendário.";
  return outlook.journey.latestLinked
    ? `Última aula registrada em ${dateLabel(outlook.journey.latestLinked.date)}.`
    : "As aulas registradas vão atualizar este percurso.";
}

function SummaryMethod({ data }: { data: Planning }): ReactElement {
  return (
    <details className={styles.method}>
      <summary>
        <Info size={14} aria-hidden="true" />
        Como essa comparação funciona
      </summary>
      <p>
        Somamos a duração prevista dos conteúdos ainda não concluídos e comparamos com as aulas
        disponíveis até {dateLabel(data.scope.semester.endOn)}, excluindo cancelamentos e dias sem
        aula. É uma comparação com a carga da programação, não uma previsão baseada na velocidade do
        professor. Conteúdos sem confirmação não são considerados concluídos.
      </p>
    </details>
  );
}

function momentIcon(current: boolean | undefined, label: string): ReactElement {
  if (current) return <Clock3 size={15} aria-hidden="true" />;
  return label === "Já trabalhado" ? (
    <Check size={15} aria-hidden="true" />
  ) : (
    <ArrowRight size={15} aria-hidden="true" />
  );
}

function ExplorerActivities({
  group,
  preview,
  onEdit,
  onClose,
}: {
  group: ContentGroup;
  preview: boolean;
  onEdit: ((item: PlannedItem) => void) | undefined;
  onClose: () => void;
}): ReactElement {
  return (
    <div className={styles.activities}>
      {group.steps.map((step) => (
        <article key={step.item.id}>
          <div className={styles.activityTitle}>
            <h3>{step.item.title}</h3>
            <Badge variant={STATES[step.state].variant}>{STATES[step.state].label}</Badge>
          </div>
          <p>
            {step.item.plannedOn
              ? `${preview ? "Cabe no calendário em" : "Previsto para"} ${dateLabel(step.item.plannedOn)}`
              : "Sem data · falta tempo no calendário"}
            {step.item.curriculum
              ? ` · ${hours(step.item.curriculum.durationMinutes)} na programação`
              : ""}
          </p>
          {step.evidence.length > 0 ? (
            <div className={styles.evidence}>
              {step.evidence.map((record) => (
                <Link
                  key={record.id}
                  href={`/turmas/${record.classId}?secao=aulas&aula=${record.id}#aulas-da-turma`}
                >
                  <ArrowUpRight size={13} aria-hidden="true" />
                  {dateLabel(record.date)} ·{" "}
                  {record.content.planItemStatus === "COMPLETED"
                    ? "Conclusão registrada"
                    : "Conteúdo trabalhado"}
                </Link>
              ))}
            </div>
          ) : (
            <p>Sem conclusão registrada.</p>
          )}
          {onEdit && step.item.plannedOn && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onClose();
                if (step.item.plannedOn) onEdit({ ...step.item, plannedOn: step.item.plannedOn });
              }}
            >
              Editar atividade
            </Button>
          )}
        </article>
      ))}
    </div>
  );
}

function JourneyMoments({
  outlook,
  current,
  next,
  previous,
  setSelected,
}: {
  outlook: Outlook;
  current: ContentGroup | undefined;
  next: ContentGroup | undefined;
  previous: ContentGroup | undefined;
  setSelected: (value: string) => void;
}): ReactElement {
  return (
    <div className={styles.moments}>
      <ContentMoment
        label="Já trabalhado"
        group={previous}
        empty="O percurso começa com os primeiros registros."
        detail={previous ? `${previous.steps.length} conteúdos concluídos` : null}
        onOpen={setSelected}
      />
      <ContentMoment
        label="Ponto atual"
        group={current}
        empty="Aguardando o primeiro registro de conteúdo."
        detail={outlook.journey.current?.item.title ?? null}
        current
        onOpen={setSelected}
      />
      <ContentMoment
        label={nextMomentLabel(outlook, current)}
        group={next}
        empty={current ? "Fim da sequência prevista." : "Programação ainda não disponível."}
        detail={outlook.journey.next?.item.title ?? null}
        onOpen={setSelected}
      />
    </div>
  );
}

function nextMomentLabel(outlook: Outlook, current: ContentGroup | undefined): string {
  return outlook.journey.next?.item.id === outlook.journey.current?.item.id && current
    ? "Para continuar"
    : "A seguir";
}
