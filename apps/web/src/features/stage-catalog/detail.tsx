"use client";
import { useState } from "react";
import { Archive, BookOpen, Pencil, Plus } from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  SegmentedControl,
  SegmentedControlItem,
  TableContainer,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { BookEditor } from "./book-editor";
import { ProgramMap } from "./program-map";
import { StageLoading } from "./loading";
import { ActionsMenu } from "./catalog-list";
import { CatalogDialog, type CatalogDialogState } from "./catalog-dialog";

import { ProgramDialog, type ProgramDialogState } from "./program-dialog";
import styles from "./workspace.module.css";

import type { StageDetail, TeachingProgram } from "./types";
import { formatWeeklyHours, programLabel, stageContext } from "./labels";
import { DEFAULT_TEACHING_MODALITY } from "@lazuli/domain";
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
      <div className={styles.detailPage}>{content}</div>
    </section>
  );
}
function StageWorkspace({ stage }: { stage: StageDetail }): React.JSX.Element {
  const [section, setSection] = useState<StageSection>("program");
  const [programId, setProgram] = useState<string | null>(null);
  const [catalogDialog, openCatalog] = useState<CatalogDialogState | null>(null);
  const [programDialog, openProgram] = useState<ProgramDialogState | null>(null);
  const [notice, setNotice] = useState("");

  const { programs } = stage;
  const program =
    programs.find((candidate) => candidate.id === programId) ??
    programs.find((candidate) => candidate.scheduleType === "REGULAR") ??
    programs[0];
  return (
    <>
      <StageHeader
        stage={stage}
        openCatalog={openCatalog}
        section={section}
        setSection={setSection}
      />
      <TableContainer>
        <div className={styles.detailSurface}>
          <div hidden={section !== "program"}>
            {program ? (
              <ProgramMap
                key={program.id}
                stage={stage}
                program={program}
                open={openProgram}
                programSelector={
                  <ProgramSelector
                    stage={stage}
                    program={program}
                    setProgram={setProgram}
                    openProgram={openProgram}
                  />
                }
              />
            ) : (
              <StartProgram stage={stage} openProgram={openProgram} openCatalog={openCatalog} />
            )}
            {program && (
              <footer className={styles.source}>Fonte: {program.source.reference}</footer>
            )}
          </div>
          <div hidden={section !== "lessons"}>
            <BookEditor stage={stage} announce={setNotice} />
          </div>
        </div>
      </TableContainer>
      {catalogDialog && (
        <CatalogDialog
          item={catalogDialog}
          stageLabel={stageContext(stage)}
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
type StageSection = "program" | "lessons";
function StageHeader({
  stage,
  openCatalog,
  section,
  setSection,
}: StageActions & {
  section: StageSection;
  setSection: (value: StageSection) => void;
}): React.JSX.Element {
  return (
    <header className={styles.detailHeading}>
      <div className={styles.detailIdentity}>
        <h1>{stage.name}</h1>
        <span className={styles.meta}>
          {stage.track.name} · {stage.internalCode}{" "}
          {(stage.status === "LEGACY" || stage.track.status === "LEGACY") && (
            <Badge variant="neutral">Legacy</Badge>
          )}
        </span>
      </div>
      <nav className={styles.tabs} aria-label="Conteúdo do estágio">
        <button
          type="button"
          aria-current={section === "program" ? "page" : undefined}
          onClick={() => setSection("program")}
        >
          Programação
        </button>
        <button
          type="button"
          aria-current={section === "lessons" ? "page" : undefined}
          onClick={() => setSection("lessons")}
        >
          Lições do livro <span>{stage.lessonCount ?? stage.lessons.length}</span>
        </button>
      </nav>
      <ActionsMenu
        name={stage.name}
        actions={[
          {
            label: "Editar identificação",
            icon: Pencil,
            onClick: () => openCatalog({ action: "editStage", ...stage }),
          },
          ...(stage.status === "ACTIVE" && stage.track.status === "ACTIVE"
            ? [
                {
                  label: "Marcar como Legacy",
                  icon: Archive,
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
    </header>
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
function ProgramSelector({
  stage,
  program,
  setProgram,
  openProgram,
}: ProgramActions & {
  program: TeachingProgram;
  setProgram: (id: string) => void;
}): React.JSX.Element {
  const { programs } = stage;
  return (
    <div className={styles.programSelection}>
      {programs.length > 1 ? (
        <SegmentedControl
          aria-label="Programação do livro"
          size="sm"
          contrast="high"
          wrap
          value={program.id}
          onValueChange={(id) => {
            if (id) setProgram(id);
          }}
        >
          {programs.map((option) => (
            <SegmentedControlItem key={option.id} value={option.id}>
              {programLabel(option, programs)}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      ) : (
        <strong>{programLabel(program, programs)}</strong>
      )}
      <span className={styles.programLoad}>
        {program.teachingHourCount} h · {formatWeeklyHours(program)} h/sem.
      </span>
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
  );
}
