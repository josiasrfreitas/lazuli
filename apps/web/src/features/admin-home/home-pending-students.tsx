import { PENDING_PAGE_SIZE as PAGE_SIZE } from "./home-pending-pagination";
import { useState, type ReactElement } from "react";
import { ArrowRight, ChevronDown, FileText, FolderOpen, Plus, UserRoundPlus } from "lucide-react";
import { Badge, Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import Link from "next/link";
import type { HomeGroup } from "./home-parts";
import { PendingDisclosure } from "./home-pending-disclosure";
import styles from "./home-pending.module.css";

const REFRESH_MS = 60_000;

export function PendingStudents({
  group,
  kind = "students",
}: {
  group: HomeGroup | undefined;
  kind?: "students" | "contracts" | "documents";
}): ReactElement | null {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const query = trpc.dashboard.pending.useQuery(
    { kind, page, pageSize: PAGE_SIZE },
    { enabled: open, refetchInterval: open ? REFRESH_MS : false },
  );
  const visibleGroup = open ? (query.data ?? group) : group;
  const total = visibleGroup?.total ?? 0;
  if (!open && total === 0) return null;
  return (
    <tr>
      <td className={styles.cell}>
        <PendingDisclosure
          onOpenChange={setOpen}
          summary={<StudentsSummary total={total} kind={kind} />}
        >
          <StudentsFeedback
            pending={query.isPending}
            error={query.isError}
            retry={() => void query.refetch()}
          />
          {query.data && <StudentsCases group={query.data} kind={kind} />}
          <StudentsPagination
            total={total}
            page={page}
            busy={query.isFetching}
            setPage={setPage}
            kind={kind}
          />
        </PendingDisclosure>
      </td>
    </tr>
  );
}

function StudentsSummary({
  total,
  kind,
}: {
  total: number;
  kind: "students" | "contracts" | "documents";
}): ReactElement {
  const { Icon, title, detail } = STUDENT_SUMMARIES[kind];
  return (
    <>
      <span className={styles.icon}>
        <Icon aria-hidden="true" />
      </span>
      <span className={styles.identity}>
        <strong>{title}</strong>
        <span>
          {total} {total === 1 ? "aluno" : "alunos"} · {detail}
        </span>
      </span>
      <span className={styles.action}>
        <ChevronDown aria-hidden="true" />
      </span>
    </>
  );
}

const STUDENT_SUMMARIES = {
  contracts: { Icon: FileText, title: "Criar primeiro contrato", detail: "sem contrato" },
  documents: {
    Icon: FolderOpen,
    title: "Aluno com anexos cadastrais ausentes ou incompletos",
    detail: "com anexos a completar",
  },
  students: {
    Icon: UserRoundPlus,
    title: "Alunos sem turma",
    detail: "entrada neste período",
  },
} as const;

function StudentsCases({
  group,
  kind,
}: {
  group: HomeGroup;
  kind: "students" | "contracts" | "documents";
}): ReactElement {
  if (kind === "documents") return <DocumentCases group={group} />;
  const contracts = kind === "contracts";
  return (
    <ul className={styles.lessonList}>
      {group.items.map((item) => (
        <li key={item.id}>
          <Link
            href={
              contracts
                ? `/alunos/${item.id}?criarContrato=1&voltar=%2F`
                : `/alunos/${item.id}?voltar=%2F`
            }
            className={styles.appointmentCase}
            aria-label={`${contracts ? "Criar primeiro contrato de" : "Definir turma de"} ${item.title}`}
          >
            <strong className={styles.caseName}>{item.title}</strong>
            {item.date && (
              <span className={styles.preview}>Cadastro em {formatDateOnlyBR(item.date)}</span>
            )}
            <span className={styles.action}>
              {contracts ? "Criar contrato" : "Definir turma"} <ArrowRight aria-hidden="true" />
            </span>
          </Link>
        </li>
      ))}
      {group.total === 0 && (
        <li className={styles.feedback}>
          {contracts ? "Nenhum aluno sem contrato." : "Nenhum aluno aguardando a primeira turma."}
        </li>
      )}
    </ul>
  );
}

const DOCUMENT_LABELS = {
  student: "Identidade aluno",
  guardian: "Responsável",
  residence: "Residência",
  photo: "Foto",
} as const;
const VISIBLE_DOCUMENTS = 3;

function DocumentCases({ group }: { group: HomeGroup }): ReactElement {
  return (
    <ul className={`${styles.lessonList} ${styles.documentList}`}>
      {group.items.map((item) => {
        const missing = item.missingDocuments ?? [];
        const remaining = Math.max(0, missing.length - VISIBLE_DOCUMENTS);
        return (
          <li key={item.id}>
            <Link
              href={`/alunos/${item.id}?secao=cadastro`}
              className={styles.documentCase}
              aria-label={`Abrir cadastro de ${item.title}. ${item.detail}`}
            >
              <strong className={styles.caseName}>{item.title}</strong>
              <span className={styles.documentAction} aria-hidden="true">
                <ArrowRight />
              </span>
              <span className={styles.documentBadges} aria-label={item.detail}>
                {missing.slice(0, VISIBLE_DOCUMENTS).map((kind) => (
                  <Badge key={kind} variant="destructive">
                    {DOCUMENT_LABELS[kind]}
                  </Badge>
                ))}
                {remaining > 0 && (
                  <Badge
                    variant="destructive"
                    aria-label={`Mais ${remaining} anexo${remaining === 1 ? "" : "s"} pendente${remaining === 1 ? "" : "s"}`}
                  >
                    <Plus aria-hidden="true" /> {remaining}
                  </Badge>
                )}
              </span>
            </Link>
          </li>
        );
      })}
      {group.total === 0 && (
        <li className={styles.feedback}>Nenhum aluno com anexos cadastrais pendentes.</li>
      )}
    </ul>
  );
}

function StudentsPagination({
  total,
  page,
  busy,
  setPage,
  kind,
}: {
  total: number;
  page: number;
  busy: boolean;
  setPage: (page: number) => void;
  kind: "students" | "contracts" | "documents";
}): ReactElement | null {
  if (total <= PAGE_SIZE) return null;
  return (
    <nav
      className={styles.placementPagination}
      aria-label={
        kind === "documents"
          ? "Paginação de alunos com anexos pendentes"
          : "Paginação de novos alunos"
      }
    >
      <Button
        variant="ghost"
        size="sm"
        disabled={page === 1 || busy}
        onClick={() => setPage(page - 1)}
      >
        Anterior
      </Button>
      <span>
        Página {page} de {Math.ceil(total / PAGE_SIZE)}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={page * PAGE_SIZE >= total || busy}
        onClick={() => setPage(page + 1)}
      >
        Próxima
      </Button>
    </nav>
  );
}

function StudentsFeedback({
  pending,
  error,
  retry,
}: {
  pending: boolean;
  error: boolean;
  retry: () => void;
}): ReactElement | null {
  if (pending)
    return (
      <p className={styles.feedback} role="status">
        Carregando alunos…
      </p>
    );
  if (error)
    return (
      <p className={styles.feedback} role="alert">
        Não foi possível atualizar os alunos.{" "}
        <button type="button" onClick={retry}>
          Tentar novamente
        </button>
      </p>
    );
  return null;
}
