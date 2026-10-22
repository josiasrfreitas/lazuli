import type { ReactElement } from "react";
import { ArrowRight, BookOpen, ChevronDown, Plus } from "lucide-react";
import { Badge, Button } from "@lazuli/ui";
import type { WorkshopView } from "./controller";
import type { Case } from "./model";
import { CaseDetail, OccurrenceDetail, Status } from "./record-views";
import styles from "./profile-proposals.module.css";
export function Identity({ compact = false }: { compact?: boolean }): ReactElement {
  return (
    <header className={styles.identity} data-compact={compact}>
      <p className={styles.breadcrumb}>
        Alunos <span>/</span> Perfil pedagógico
      </p>
      <div className={styles.name}>
        <h1>Marina Oliveira</h1>
        <Badge variant="success">Ativa</Badge>
      </div>
      <p>Teens Connect · Connect 1</p>
    </header>
  );
}

export function StudentContext(): ReactElement {
  return (
    <aside className={styles.context} aria-label="Contexto da aluna">
      <SchoolContext />
      <section>
        <h2>Aprendizagem</h2>
        <dl>
          <div>
            <dt>Frequência</dt>
            <dd>
              93% <small>26 de 28 aulas</small>
            </dd>
          </div>
          <div>
            <dt>Média geral</dt>
            <dd>
              76,75 <small>estágio atual</small>
            </dd>
          </div>
        </dl>
      </section>
      <section>
        <h2>Família</h2>
        <p>Carolina Oliveira</p>
        <p className={styles.muted}>Responsável pela aluna</p>
      </section>
      <details>
        <summary>
          Último atendimento <ChevronDown aria-hidden="true" />
        </summary>
        <p>Conversa com a família · 8 de outubro</p>
        <p className={styles.muted}>
          Combinada uma rotina curta de escrita em casa. Exemplo fictício do workshop.
        </p>
      </details>
    </aside>
  );
}

export function NewRecord({
  vm,
  primary = false,
}: {
  vm: WorkshopView;
  primary?: boolean;
}): ReactElement {
  return (
    <div className={styles.inlineActions}>
      <Button
        size="sm"
        variant={primary ? "primary" : "secondary"}
        onClick={() => vm.open("occurrence")}
      >
        <Plus aria-hidden="true" />
        Registrar ocorrência
      </Button>
      <Button size="sm" variant="ghost" onClick={() => vm.open("create")}>
        Abrir intervenção
      </Button>
    </div>
  );
}

export function EmptyState({ vm }: { vm: WorkshopView }): ReactElement {
  return (
    <section className={styles.empty}>
      <BookOpen aria-hidden="true" />
      <h2>A história começa no próximo registro</h2>
      <p>
        Registre uma situação da aula ou abra uma intervenção para combinar uma atuação com a aluna.
      </p>
      <NewRecord vm={vm} primary />
    </section>
  );
}

export function Detail({
  vm,
  fallback,
}: {
  vm: WorkshopView;
  fallback?: Case | undefined;
}): ReactElement {
  const row = vm.selectedCase ?? (vm.selectedOccurrence ? undefined : fallback);
  if (row)
    return (
      <CaseDetail
        row={row}
        state={vm.state}
        open={vm.open}
        select={vm.setSelection}
        focus={false}
      />
    );
  if (vm.selectedOccurrence)
    return (
      <OccurrenceDetail
        row={vm.selectedOccurrence}
        state={vm.state}
        open={vm.open}
        select={vm.setSelection}
      />
    );
  return (
    <p className={styles.empty}>
      Selecione um registro para consultar o contexto e continuar a atuação.
    </p>
  );
}

export function CaseLink({ row, vm }: { row: Case; vm: WorkshopView }): ReactElement {
  return (
    <button
      type="button"
      className={styles.caseLink}
      aria-pressed={vm.selectedCase?.id === row.id}
      onClick={() => vm.setSelection({ type: "case", id: row.id })}
    >
      <span>
        <Status row={row} />
        <strong>{row.title}</strong>
        <small>{row.teacher}</small>
      </span>
      <ArrowRight aria-hidden="true" />
    </button>
  );
}

function SchoolContext(): ReactElement {
  return (
    <section>
      <h2>Na escola</h2>
      <dl>
        <div>
          <dt>Turma</dt>
          <dd>Connect 1</dd>
        </div>
        <div>
          <dt>Professora</dt>
          <dd>Beatriz Albuquerque</dd>
        </div>
        <div>
          <dt>Encontros</dt>
          <dd>Seg e qua · 14h–15h30</dd>
        </div>
      </dl>
    </section>
  );
}
