"use client";

import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Activity, ChevronDown, Info } from "lucide-react";
import {
  Badge,
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
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { ProfileError } from "./profile-shared";
import styles from "./student-overview.module.css";
import loading from "./student-loading.module.css";

type Health = RouterOutputs["students"]["health"];
const LABELS = {
  attendance: "Frequência",
  grades: "Notas",
  occurrences: "Ocorrências",
  interventions: "Intervenções",
};
const LEVELS = {
  HEALTHY: { label: "Vínculo saudável", variant: "success" },
  ATTENTION: { label: "Requer atenção", variant: "warning" },
  PRIORITY: { label: "Acompanhamento prioritário", variant: "destructive" },
  INSUFFICIENT_DATA: { label: "Em formação", variant: "neutral" },
} as const;
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function StudentHealth({ studentId }: { studentId: string }): ReactElement {
  const query = trpc.students.health.useQuery({ id: studentId }, { staleTime: 0 });
  return (
    <section className={styles.health} aria-labelledby="student-health-title">
      <HealthHeader health={query.data} />
      {query.isError && (
        <ProfileError message="Score indisponível." onRetry={() => void query.refetch()} />
      )}
      {!query.isError && query.data && <HealthReading health={query.data} />}
      {!query.isError && !query.data && <HealthLoading />}
    </section>
  );
}

export function StudentHealthLoading(): ReactElement {
  return (
    <section className={styles.health} aria-labelledby="student-health-title">
      <HealthHeader />
      <HealthLoading />
    </section>
  );
}

function HealthHeader({ health }: { health?: Health | undefined }): ReactElement {
  return (
    <header className={styles.sectionHeading}>
      <h2 id="student-health-title">
        <Activity aria-hidden="true" /> Saúde do vínculo
      </h2>
      {health ? (
        <HealthExplanation health={health} />
      ) : (
        <Button
          size="icon-sm"
          variant="ghost"
          disabled
          aria-label="Como o health score é calculado"
        >
          <Info aria-hidden="true" />
        </Button>
      )}
    </header>
  );
}

function HealthReading({ health }: { health: Health }): ReactElement {
  const level = LEVELS[health.level];
  return (
    <div className={styles.reveal}>
      <div className={styles.healthReading} data-level={health.level}>
        <p className={styles.healthNumber}>
          {health.score ?? "—"}
          <span>/100</span>
        </p>
        <div className={styles.healthStatus}>
          <Badge variant={level.variant}>{level.label}</Badge>
          <span>
            {health.score === null ? "Aguardando registros do período" : "Health score do aluno"}
          </span>
        </div>
      </div>
      {health.score !== null && (
        <meter
          className={styles.healthMeter}
          data-level={health.level}
          min={0}
          max={100}
          value={health.score}
          aria-label={`Saúde do vínculo: ${health.score} de 100`}
        />
      )}
      <dl className={styles.healthIndicators}>
        {health.indicators.map((indicator) => (
          <div key={indicator.key}>
            <dt>{LABELS[indicator.key]}</dt>
            <dd>{indicatorValue(health, indicator)}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.supporting}>
        {health.from ? "Período letivo atual" : "Sem matrícula no período atual"}
        {health.score !== null && ` · ${health.availableIndicators} de 4 indicadores disponíveis`}
      </p>
    </div>
  );
}

function indicatorValue(health: Health, indicator: Health["indicators"][number]): string {
  if (indicator.key === "occurrences")
    return indicator.score === null ? "Sem registros" : `${health.occurrenceCount} no período`;
  if (indicator.key === "interventions")
    return health.occurrenceCount
      ? `${health.accompaniedOccurrences} de ${health.occurrenceCount} ocorrências acompanhadas`
      : "Não se aplica";
  if (indicator.score === null) return "Sem dados";
  return `${number.format(indicator.score)}${indicator.key === "attendance" ? "%" : " / 100"}`;
}

function HealthExplanation({ health }: { health: Health }): ReactElement {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button size="icon-sm" variant="ghost" />}
        aria-label="Como o health score é calculado"
      >
        <Info aria-hidden="true" />
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="md:max-w-2xl" data-student-dialog-motion>
          <DialogHeader>
            <DialogTitle>Como o score é calculado</DialogTitle>
            <DialogDescription>
              Média ponderada dos indicadores disponíveis, em uma escala de 0 a 100.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className={styles.scoreExplanation}>
              <p>
                {health.from
                  ? `Acompanhamento de ${formatDateOnlyBR(health.from)} a ${formatDateOnlyBR(health.through)}, nas matrículas do período letivo atual.`
                  : "O cálculo começa quando houver matrícula e registros no período letivo atual."}
              </p>
              <HealthScoreBands />
              <HealthRules health={health} />
              <p className={styles.supporting}>
                Indicadores sem dados ficam fora da média; seus pesos são redistribuídos.
              </p>
              <p className={styles.supporting}>
                Critério inicial de acompanhamento. O score ajuda a orientar o contato; os registros
                pedagógicos dão o contexto.
              </p>
            </div>
          </DialogBody>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function HealthScoreBands(): ReactElement {
  return (
    <ul className={styles.scoreBands} aria-label="Faixas do score">
      <li>
        <strong>80–100</strong>
        <span>Vínculo saudável</span>
      </li>
      <li>
        <strong>60–79</strong>
        <span>Requer atenção</span>
      </li>
      <li>
        <strong>Abaixo de 60</strong>
        <span>Acompanhamento prioritário</span>
      </li>
    </ul>
  );
}

function HealthRules({ health }: { health: Health }): ReactElement {
  return (
    <dl className={styles.scoreRules}>
      {health.indicators.map((indicator) => (
        <div key={indicator.key}>
          <dt>
            <strong>{LABELS[indicator.key]}</strong>
            <span>Peso {indicator.weight}%</span>
          </dt>
          <dd className={styles.scoreRuleResult}>
            <strong>
              {indicator.score === null ? "Sem dados" : `${number.format(indicator.score)} / 100`}
            </strong>
          </dd>
          <dd className={styles.scoreRuleDetails}>
            <details>
              <summary>
                Como é calculado <ChevronDown aria-hidden="true" />
              </summary>
              <p>{indicatorDescription(indicator.key)}</p>
              <p>{indicatorEvidence(health, indicator.key)}</p>
            </details>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function indicatorDescription(key: Health["indicators"][number]["key"]): string {
  switch (key) {
    case "attendance": {
      return "Percentual de presença nas aulas com chamada confirmada, por minutos, incluindo reposições concluídas vinculadas às faltas.";
    }
    case "grades": {
      return "Média das notas lançadas no período letivo atual, incluindo etapas concluídas e recuperação. Notas não lançadas ficam de fora.";
    }
    case "occurrences": {
      return "Parte de 100 pontos e desconta 10 por ocorrência no período, até o mínimo de zero. Sem aulas ou ocorrências registradas, fica fora do cálculo.";
    }
    case "interventions": {
      return "Percentual de ocorrências do período vinculadas a pelo menos uma intervenção. Cada ocorrência conta uma vez; o acompanhamento aumenta este indicador.";
    }
  }
}

function indicatorEvidence(health: Health, key: Health["indicators"][number]["key"]): string {
  switch (key) {
    case "attendance": {
      return `${health.heldSessions} aulas com chamada confirmada.`;
    }
    case "grades": {
      return `${health.gradeCount} notas lançadas.`;
    }
    case "occurrences": {
      return `${health.occurrenceCount} ocorrências registradas.`;
    }
    case "interventions": {
      return `${health.interventionCount} intervenções vinculadas, acompanhando ${health.accompaniedOccurrences} de ${health.occurrenceCount} ocorrências.`;
    }
  }
}

function HealthLoading(): ReactElement {
  return (
    <div className={loading.surface} aria-label="Calculando saúde do vínculo" aria-busy="true">
      <div className={styles.healthReading}>
        <p className={styles.healthNumber}>
          <InlineSkeleton shape="block" className="h-12 w-14" />
          <span>/100</span>
        </p>
        <div className={styles.healthStatus}>
          <InlineSkeleton shape="block" className="h-5 w-28" />
          <InlineSkeleton className="w-32" />
        </div>
      </div>
      <InlineSkeleton shape="block" className="block h-1.5 w-full" />
      <dl className={styles.healthIndicators}>
        {Object.values(LABELS).map((label) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <InlineSkeleton className="w-20 max-w-full" />
            </dd>
          </div>
        ))}
      </dl>
      <p className={styles.supporting}>
        <InlineSkeleton className="w-56 max-w-full" />
      </p>
    </div>
  );
}
