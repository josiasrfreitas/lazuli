"use client";
import { useState } from "react";
import { BookOpen, Pencil, Plus } from "lucide-react";
import {
  Badge,
  Button,
  DetailHeader,
  EmptyState,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { ProgramMap } from "./program-map";
import { StageLoading } from "./loading";
import { ActionsMenu } from "./catalog-list";
import { CatalogDialog, type CatalogDialogState } from "./catalog-dialog";
import { Choice } from "./editor-form";
import { ProgramDialog, type ProgramDialogState } from "./program-dialog";
import styles from "./workspace.module.css";

import type { StageDetail, TeachingProgram } from "./types";
import { DEFAULT_TEACHING_MODALITY, TEACHING_HOUR_MINUTES } from "@lazuli/domain";
type StageActions = { stage: StageDetail; openCatalog: (item: CatalogDialogState) => void };
type ProgramActions = { stage: StageDetail; openProgram: (item: ProgramDialogState) => void };
export function StageEditor({ id }: { id: string }): React.JSX.Element {
  const query = trpc.teachingPrograms.detail.useQuery({ id });
  let content: React.JSX.Element;
  if (query.isPending) content = <StageLoading />;
  else if (query.data) content = <StageWorkspace key={id} stage={query.data} />;
  else
    content = (
      <EmptyState
        title={query.isError ? "Não foi possível carregar o estágio" : "Estágio indisponível"}
        action={
          query.isError ? (
            <Button onClick={() => void query.refetch()}>Tentar novamente</Button>
          ) : undefined
        }
      />
    );
  return (
    <section className={styles.scroll}>
      <div className={styles.page}>{content}</div>
    </section>
  );
}
function StageWorkspace({ stage }: { stage: StageDetail }): React.JSX.Element {
  const [section, setSection] = useState("program");
  const [programId, setProgram] = useState<string | null>(null);
  const [catalogDialog, openCatalog] = useState<CatalogDialogState | null>(null);
  const [programDialog, openProgram] = useState<ProgramDialogState | null>(null);
  const [notice, setNotice] = useState("");

  const { programs } = stage;
  const program =
    programs.find((candidate) => candidate.id === programId) ??
    programs.find((candidate) => candidate.scheduleType === "REGULAR") ??
    programs[0];
  let content: React.JSX.Element;
  if (section === "lessons") content = <Lessons stage={stage} openCatalog={openCatalog} />;
  else if (program)
    content = (
      <ProgramWorkspace
        key={program.id}
        stage={stage}
        program={program}
        setProgram={setProgram}
        openProgram={openProgram}
      />
    );
  else content = <StartProgram stage={stage} openProgram={openProgram} openCatalog={openCatalog} />;
  return (
    <>
      <StageHeader stage={stage} openCatalog={openCatalog} />
      <nav className={styles.tabs} aria-label="Conteúdo do estágio">
        {[
          ["program", "Programação"],
          ["lessons", "Lições do livro"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-current={section === key ? "page" : undefined}
            onClick={() => setSection(key!)}
          >
            {label}
            {key === "lessons" && <span>{stage.lessonCount ?? stage.lessons.length}</span>}
          </button>
        ))}
      </nav>
      {content}
      {catalogDialog && (
        <CatalogDialog
          item={catalogDialog}
          onClose={() => openCatalog(null)}
          afterSave={() => setNotice("Alteração salva.")}
        />
      )}
      {programDialog && (
        <ProgramDialog
          item={programDialog}
          stage={stage}
          onClose={() => openProgram(null)}
          onSave={(pid) => {
            setProgram(pid);
            setNotice("Programação atualizada.");
          }}
        />
      )}
      <span className="sr-only" role="status">
        {notice}
      </span>
    </>
  );
}
function StageHeader({ stage, openCatalog }: StageActions): React.JSX.Element {
  return (
    <DetailHeader
      title={stage.name}
      metadataPlacement="below"
      metadata={
        <span className={styles.meta}>
          {stage.track.name} · {stage.internalCode}{" "}
          {(stage.status === "LEGACY" || stage.track.status === "LEGACY") && (
            <Badge variant="neutral">Legacy</Badge>
          )}
        </span>
      }
      actions={
        <ActionsMenu
          name={stage.name}
          actions={[
            {
              label: "Editar identificação",
              onClick: () => openCatalog({ action: "editStage", ...stage }),
            },
            ...(stage.status === "ACTIVE" && stage.track.status === "ACTIVE"
              ? [
                  {
                    label: "Marcar como Legacy",
                    onClick: () =>
                      openCatalog({
                        action: "legacy",
                        target: "stage",
                        id: stage.id,
                        name: stage.name,
                      }),
                  },
                ]
              : []),
          ]}
        />
      }
    />
  );
}
function Lessons({ stage, openCatalog }: StageActions): React.JSX.Element {
  return (
    <section>
      <header className={styles.unitTitle}>
        <h2>Lições do livro</h2>
        <Button size="sm" onClick={() => openCatalog({ action: "lesson", stageId: stage.id })}>
          <Plus />
          Adicionar lição
        </Button>
      </header>
      {stage.lessons.length === 0 ? (
        <EmptyState title="O livro ainda não tem lições cadastradas" />
      ) : (
        <ol className={styles.lessons}>
          {stage.lessons.map((lesson) => (
            <li key={lesson.id}>
              <span className={styles.ordinal}>{String(lesson.sequence).padStart(2, "0")}</span>
              <strong>{lesson.title}</strong>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={"Editar " + lesson.title}
                onClick={() => openCatalog({ action: "lesson", stageId: stage.id, lesson: lesson })}
              >
                <Pencil />
              </Button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
function StartProgram({
  stage,
  openCatalog,
  openProgram,
}: StageActions & ProgramActions): React.JSX.Element {
  return (
    <EmptyState
      icon={<BookOpen />}
      title="Programação do livro"
      description={
        stage.lessons.length > 0
          ? "Comece pela primeira unidade e pela prova prevista no livro."
          : "Cadastre a primeira lição do livro para montar a programação."
      }
      action={
        <Button
          size="sm"
          onClick={() =>
            stage.lessons.length > 0
              ? openProgram({ action: "start" })
              : openCatalog({ action: "lesson", stageId: stage.id })
          }
        >
          <Plus />
          {stage.lessons.length > 0 ? "Iniciar programação" : "Adicionar primeira lição"}
        </Button>
      }
    />
  );
}
function ProgramWorkspace({
  stage,
  program,
  setProgram,
  openProgram,
}: ProgramActions & {
  program: TeachingProgram;
  setProgram: (id: string) => void;
}): React.JSX.Element {
  const { programs } = stage;
  const [exams, setExams] = useState(false);
  return (
    <>
      <div className={styles.programBar}>
        <div>
          {programs.length > 1 ? (
            <Choice
              label="Programação do livro"
              options={programs.map((candidate) => programOption(candidate))}
              value={program.id}
              onChange={setProgram}
            />
          ) : (
            <strong>
              {program.scheduleType === "REGULAR" ? "Regular" : "PPT"} · {program.teachingHourCount}{" "}
              horas-aula · {program.modality.weeklyMinutes / TEACHING_HOUR_MINUTES}h/sem.
            </strong>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            aria-label="Conteúdo da programação"
            size="sm"
            value={exams ? "exams" : "all"}
            onValueChange={(value) => {
              if (value) setExams(value === "exams");
            }}
          >
            <SegmentedControlItem value="all">Tudo</SegmentedControlItem>
            <SegmentedControlItem value="exams">
              Provas ({program.assessmentCount})
            </SegmentedControlItem>
          </SegmentedControl>
          {!["REGULAR", "PERSONALIZED"].every((mode) =>
            programs.some(
              (candidate) =>
                candidate.scheduleType === mode &&
                candidate.modality.weeklyMinutes === DEFAULT_TEACHING_MODALITY.weeklyMinutes,
            ),
          ) && (
            <Button size="sm" variant="ghost" onClick={() => openProgram({ action: "start" })}>
              <Plus />
              Adicionar programação
            </Button>
          )}
        </div>
      </div>
      <ProgramMap
        key={program.id}
        stage={stage}
        program={program}
        exams={exams}
        open={openProgram}
      />
      <footer className={styles.source}>Fonte: {program.source.reference}</footer>
    </>
  );
}

function programOption(candidate: TeachingProgram): { label: string; value: string } {
  return {
    value: candidate.id,
    label:
      (candidate.scheduleType === "REGULAR" ? "Regular" : "PPT") +
      " · " +
      candidate.teachingHourCount +
      "h · " +
      candidate.modality.weeklyMinutes / TEACHING_HOUR_MINUTES +
      "h/sem.",
  };
}
