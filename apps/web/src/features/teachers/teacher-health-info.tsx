"use client";
import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { STUDENT_HEALTH_WEIGHTS } from "@lazuli/domain";
import { BookOpen, CalendarCheck, ClipboardList, HeartHandshake, Info } from "lucide-react";
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
} from "@lazuli/ui";
import { metricNumber } from "./teacher-metric-details";
import styles from "./teacher-health-info.module.css";

type Metrics = RouterOutputs["teachers"]["metrics"];
const INDICATORS = [
  {
    key: "attendance",
    title: "Frequência",
    icon: CalendarCheck,
    description: "Presença e faltas compensadas, ponderadas pela duração das aulas.",
  },
  {
    key: "grades",
    title: "Aprendizagem",
    icon: BookOpen,
    description: "Média das notas registradas para o aluno, de 0 a 100.",
  },
  {
    key: "occurrences",
    title: "Ocorrências",
    icon: ClipboardList,
    description: "Começa em 100 e desconta 10 pontos por ocorrência em aula, até o mínimo de zero.",
  },
  {
    key: "interventions",
    title: "Acompanhamento",
    icon: HeartHandshake,
    description: "Percentual de ocorrências com ao menos uma intervenção vinculada ao aluno.",
  },
] as const;
export function TeacherHealthInfo({ data }: { data: Metrics | undefined }): ReactElement {
  const sum = data?.students.reduce((total, student) => total + (student.score ?? 0), 0);
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Como funciona a saúde dos alunos" />
        }
      >
        <Info aria-hidden="true" />
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="md:max-w-4xl">
          <DialogHeader>
            <DialogTitle>O que forma o score de cada aluno</DialogTitle>
            <DialogDescription>
              Quatro indicadores ajudam a identificar quem precisa de um acompanhamento mais
              próximo.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className={styles.body}>
              <section className={styles.indicators} aria-label="Composição do score individual">
                <p>Os pesos abaixo valem quando os quatro indicadores têm dados.</p>
                <dl>
                  {INDICATORS.map(({ key, title, icon: Icon, description }) => (
                    <div key={key}>
                      <dt>
                        <Icon aria-hidden="true" />
                        <span>{title}</span>
                        <strong>{STUDENT_HEALTH_WEIGHTS[key]}%</strong>
                      </dt>
                      <dd>{description}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              <section className={styles.thresholds} aria-label="Faixas de saúde">
                <div data-tone="success">
                  <strong>80–100</strong>
                  <span>Saudável</span>
                </div>
                <div data-tone="warning">
                  <strong>60–79</strong>
                  <span>Em atenção</span>
                </div>
                <div data-tone="danger">
                  <strong>0–59</strong>
                  <span>Prioridade</span>
                </div>
              </section>
              <div className={styles.methods}>
                <details className={styles.method}>
                  <summary>Como chegamos ao score médio dos alunos?</summary>
                  <p>
                    Cada aluno tem o mesmo peso e entra uma única vez, mesmo que participe de mais
                    de uma turma. Alunos sem dados suficientes ficam fora da média.
                  </p>
                  <section className={styles.calculation} aria-label="Cálculo do score médio atual">
                    <div>
                      <strong>{metricNumber(sum)}</strong>
                      <span>soma dos scores</span>
                    </div>
                    <span className={styles.operator} aria-label="dividida por">
                      ÷
                    </span>
                    <div>
                      <strong>{data?.coveredStudents ?? "—"}</strong>
                      <span>alunos com dados</span>
                    </div>
                    <span className={styles.operator} aria-label="igual a">
                      =
                    </span>
                    <div className={styles.result}>
                      <strong>{metricNumber(data?.score)}</strong>
                      <span>score médio · de 0 a 100</span>
                    </div>
                  </section>
                  <div className={styles.coverage}>
                    <span>
                      {data
                        ? `${data.coveredStudents} de ${data.studentCount} alunos entram na média`
                        : "A média aparecerá quando os dados forem carregados"}
                    </span>
                  </div>
                </details>
                <details className={styles.method}>
                  <summary>E quando faltam notas ou não há ocorrências?</summary>
                  <p>
                    Um indicador sem evidência sai do cálculo; os pesos restantes são redistribuídos
                    proporcionalmente. Sem notas não significa nota zero. Sem ocorrências, o
                    indicador de acompanhamento não participa.
                  </p>
                  <p>
                    Exemplo: com apenas frequência e ocorrências, os pesos disponíveis somam 55. A
                    frequência representa 35/55 do cálculo e ocorrências, 20/55. O score individual
                    é arredondado antes de entrar na média.
                  </p>
                </details>
                <details className={styles.method}>
                  <summary>Qual período e quais registros entram?</summary>
                  <p>
                    Usamos o mesmo score da página do aluno: matrículas nos semestres atuais,
                    registros até hoje e os respectivos períodos de vínculo. Esse histórico pode
                    incluir aulas de outros professores.
                  </p>
                  <p>
                    As ocorrências fora de aula aparecem em Acompanhamento, mas ainda não compõem o
                    score individual. As notas e faltas da visão geral do professor têm um recorte
                    próprio, limitado à sua atuação.
                  </p>
                </details>
              </div>
              <p className={styles.interpretation}>
                Uma média alta pode esconder dificuldades individuais. O score orienta o
                acompanhamento; não é uma avaliação do professor.
              </p>
            </div>
          </DialogBody>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
