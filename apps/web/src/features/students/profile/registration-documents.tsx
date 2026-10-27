"use client";

import { useState, type Dispatch, type ReactElement, type SetStateAction } from "react";
import type { RouterOutputs } from "@lazuli/api";
import {
  Camera,
  Check,
  ExternalLink,
  FileText,
  FolderOpen,
  House,
  IdCard,
  Plus,
  UsersRound,
} from "lucide-react";
import { Button, InlineSkeleton } from "@lazuli/ui";
import { trpc, type QueryResult } from "~/lib/trpc";
import {
  DOCUMENTS,
  statusLabel,
  type DocumentDefinition,
  type DocumentKind,
} from "~/features/student-documents/model";
import { RegistrationDocumentUpload } from "./registration-document-upload";
import {
  DocumentImage,
  DocumentThumbnail,
  RegistrationDocumentLoading,
} from "./registration-document-preview";
import styles from "./student-registration.module.css";
import { PdfPreview } from "~/features/student-documents/pdf-preview";
import { StudentDocumentDeleteButton } from "~/features/student-documents/delete-document-button";

const DOCUMENT_LABELS = {
  student: "Aluno",
  guardian: "Responsável",
  residence: "Residência",
  photo: "Foto",
  payment: "Pagamento",
};
const DOCUMENT_ICONS = {
  student: IdCard,
  guardian: UsersRound,
  residence: House,
  photo: Camera,
  payment: FileText,
};
const PROCESSING_POLL_MS = 3000;
type DocumentFile = RouterOutputs["studentDocuments"]["list"][number];
type DocumentSlot = { id: string; kind: DocumentKind; file: DocumentFile | undefined };

function documentSlots(files: DocumentFile[]): DocumentSlot[] {
  return DOCUMENTS.flatMap<DocumentSlot>((document) => {
    const matching = files.filter((file) => file.kind === document.id);
    if (matching.length > 0)
      return matching.map((file) => ({ id: file.id, kind: document.id, file }));
    if (document.id === "payment") return [];
    return [{ id: `empty-${document.id}`, kind: document.id, file: undefined }];
  });
}

function selectedSlot(slots: DocumentSlot[], selectedId: string | null): DocumentSlot | undefined {
  return (
    slots.find((slot) => slot.id === selectedId) ??
    slots.find((slot) => slot.file && slot.kind !== "photo") ??
    slots.find((slot) => slot.file) ??
    slots[0]
  );
}

type DocumentsModel = {
  studentId: string;
  onBusyChange: (busy: boolean) => void;
  documents: QueryResult<RouterOutputs["studentDocuments"]["list"]>;
  files: DocumentFile[];
  slots: DocumentSlot[];
  upload: DocumentDefinition | null;
  setUpload: Dispatch<SetStateAction<DocumentDefinition | null>>;
  selected: DocumentSlot | undefined;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  definition: DocumentDefinition | undefined;
  file: DocumentFile | undefined;
  processing: boolean;
  refresh: () => Promise<void>;
};

function useDocumentsModel(
  studentId: string,
  onBusyChange: (busy: boolean) => void,
): DocumentsModel {
  const documents = trpc.studentDocuments.list.useQuery(
    { studentId },
    {
      refetchInterval: (query) =>
        query.state.data?.some((file) => file.status === "RECEIVED" || file.status === "PROCESSING")
          ? PROCESSING_POLL_MS
          : false,
    },
  );
  const utils = trpc.useUtils();
  const [upload, setUpload] = useState<DocumentDefinition | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const files = documents.data ?? [];
  const slots = documentSlots(files);
  const selected = selectedSlot(slots, selectedId);
  const definition = DOCUMENTS.find((document) => document.id === selected?.kind);
  const file = selected?.file;
  const processing = file?.status === "RECEIVED" || file?.status === "PROCESSING";
  async function refresh(): Promise<void> {
    const result = await documents.refetch();
    const newest = result.data?.find((item) => item.kind === upload?.id);
    if (newest) setSelectedId(newest.id);
    await utils.studentDocuments.photo.invalidate({ studentId });
  }
  return {
    studentId,
    onBusyChange,
    documents,
    files,
    slots,
    upload,
    setUpload,
    selected,
    setSelectedId,
    definition,
    file,
    processing,
    refresh,
  };
}

function DocumentSelector({ model }: { model: DocumentsModel }): ReactElement {
  return (
    <div className={styles.documentSelector} role="group" aria-label="Selecionar documento">
      {model.slots.map((slot) => (
        <DocumentChoice key={slot.id} slot={slot} model={model} />
      ))}
    </div>
  );
}

function choiceAriaLabel(slot: DocumentSlot, multiple: boolean): string {
  const title = DOCUMENTS.find((item) => item.id === slot.kind)?.title ?? "Documento";
  if (!multiple || !slot.file) return title;
  return `${title} · ${slot.file.updatedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;
}

function DocumentChoice({
  slot,
  model,
}: {
  slot: DocumentSlot;
  model: DocumentsModel;
}): ReactElement {
  const multiple = model.slots.filter((item) => item.kind === slot.kind).length > 1;
  return (
    <button
      type="button"
      className={styles.documentChoice}
      aria-label={choiceAriaLabel(slot, multiple)}
      aria-pressed={model.selected?.id === slot.id}
      onClick={() => model.setSelectedId(slot.id)}
    >
      <DocumentChoicePreview slot={slot} />
      <span className={styles.choiceLabel}>{DOCUMENT_LABELS[slot.kind]}</span>
      <span className={styles.choiceStatus}>
        {slot.file ? (
          <>
            <Check aria-hidden="true" />
            Anexado
          </>
        ) : (
          "Não anexado"
        )}
      </span>
      {multiple && slot.file && (
        <small>
          {slot.file.updatedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
        </small>
      )}
    </button>
  );
}

function DocumentChoicePreview({ slot }: { slot: DocumentSlot }): ReactElement {
  if (slot.file?.format === "pdf")
    return (
      <span className={styles.choicePlaceholder}>
        <FileText aria-hidden="true" />
      </span>
    );
  if (slot.file)
    return (
      <DocumentThumbnail
        key={`${slot.file.id}-${slot.file.updatedAt.getTime()}`}
        src={`/api/student-document-files/${slot.file.id}?v=${slot.file.updatedAt.getTime()}`}
      />
    );
  const Icon = DOCUMENT_ICONS[slot.kind];
  return (
    <span className={styles.choicePlaceholder}>
      <Icon aria-hidden="true" />
    </span>
  );
}

function DocumentStage({ model }: { model: DocumentsModel }): ReactElement {
  const { selected, definition, file, processing } = model;
  return (
    <div className={styles.documentStage} key={selected?.id}>
      <div className={styles.previewTitle}>
        <h4>{definition?.title}</h4>
        <span
          className={styles.documentStatus}
          data-processing={processing || undefined}
          data-failed={file?.status === "FAILED" || undefined}
        >
          {processing && <span className={styles.processingDot} aria-hidden="true" />}
          {file ? statusLabel(file.status) : "Não anexado"}
        </span>
      </div>
      <StagePreview model={model} />
      <StageActions model={model} />
    </div>
  );
}

function StagePreview({ model }: { model: DocumentsModel }): ReactElement {
  const { file, definition } = model;
  if (file?.format === "pdf")
    return (
      <PdfPreview
        src={`/api/student-document-files/${file.id}?v=${file.updatedAt.getTime()}`}
        title={definition?.title ?? "Documento"}
        showOpenLink={false}
      />
    );
  if (file)
    return (
      <DocumentImage
        key={`${file.id}-${file.updatedAt.getTime()}`}
        id={file.id}
        version={file.updatedAt.getTime()}
        title={definition?.title ?? "Documento"}
        photo={file.kind === "photo"}
      />
    );
  return <EmptyDocumentPreview model={model} />;
}

function EmptyDocumentPreview({ model }: { model: DocumentsModel }): ReactElement {
  const { definition, setUpload } = model;
  const Icon = DOCUMENT_ICONS[definition?.id ?? "student"];
  return (
    <div className={styles.preview} data-empty="true">
      <div className={styles.documentPlaceholder}>
        <Icon aria-hidden="true" />
        <div>
          <p>
            {definition?.id === "photo"
              ? "Adicione uma foto do aluno"
              : "Adicione este documento ao cadastro"}
          </p>
          <span>{definition?.detail}</span>
        </div>
        {definition && (
          <Button size="compact-responsive" onClick={() => setUpload(definition)}>
            <Plus aria-hidden="true" />
            Anexar documento
          </Button>
        )}
      </div>
    </div>
  );
}

function StageActions({ model }: { model: DocumentsModel }): ReactElement {
  const { file, definition, setUpload, onBusyChange, setSelectedId } = model;
  if (!file)
    return (
      <div className={styles.documentActions}>
        <span className={styles.uploadHint}>
          {definition?.id === "photo" ? "JPG ou PNG" : "JPG, PNG ou PDF · PDF até 5 MB"}
        </span>
      </div>
    );
  return (
    <div className={styles.documentActions}>
      <a
        href={`/api/student-document-files/${file.id}`}
        target="_blank"
        rel="noreferrer"
        className={styles.original}
      >
        <ExternalLink aria-hidden="true" />
        {file.format === "pdf" ? "Abrir PDF" : "Abrir original"}
      </a>
      {definition && definition.id !== "payment" && (
        <Button variant="ghost" size="compact-responsive" onClick={() => setUpload(definition)}>
          Enviar nova versão
        </Button>
      )}
      <StudentDocumentDeleteButton
        fileId={file.id}
        title={definition?.title ?? "Anexo"}
        onBusyChange={onBusyChange}
        onDeleted={() => setSelectedId(null)}
      />
    </div>
  );
}

export function RegistrationDocuments({
  studentId,
  onBusyChange,
}: {
  studentId: string;
  onBusyChange: (busy: boolean) => void;
}): ReactElement {
  const model = useDocumentsModel(studentId, onBusyChange);

  if (model.upload)
    return (
      <section className={styles.documents} aria-label="Anexar documento">
        <RegistrationDocumentUpload
          studentId={studentId}
          document={model.upload}
          onBusyChange={onBusyChange}
          onSent={() => void model.refresh()}
          onBack={() => {
            model.setUpload(null);
            void model.refresh();
          }}
        />
      </section>
    );
  return <DocumentsBrowser model={model} />;
}

function DocumentsBrowser({ model }: { model: DocumentsModel }): ReactElement {
  return (
    <section className={styles.documents} aria-label="Documentos do aluno">
      <DocumentsHeader model={model} />
      <DocumentsBody model={model} />
    </section>
  );
}

function DocumentsHeader({ model }: { model: DocumentsModel }): ReactElement {
  return (
    <header className={styles.documentHeader}>
      <h3>
        <FolderOpen aria-hidden="true" />
        Documentos
      </h3>
      {model.documents.isPending ? (
        <InlineSkeleton className="w-16" />
      ) : (
        !model.documents.isError && (
          <span className={styles.count}>
            {model.files.length} {model.files.length === 1 ? "arquivo" : "arquivos"}
          </span>
        )
      )}
    </header>
  );
}

function DocumentsBody({ model }: { model: DocumentsModel }): ReactElement {
  if (model.documents.isPending) return <DocumentsLoading />;
  if (model.documents.isError)
    return (
      <div className={styles.empty} role="alert">
        <FolderOpen aria-hidden="true" />
        <p>Não foi possível carregar os documentos.</p>
        <Button
          variant="secondary"
          size="sm"
          loading={model.documents.isFetching}
          onClick={() => void model.documents.refetch()}
        >
          Tentar novamente
        </Button>
      </div>
    );
  return (
    <>
      <DocumentSelector model={model} />
      <DocumentStage model={model} />
    </>
  );
}

function DocumentsLoading(): ReactElement {
  return (
    <>
      <div className={styles.documentSelector} aria-hidden="true">
        {["student", "guardian", "residence", "photo"].map((kind) => (
          <div key={kind} className={styles.choiceSkeleton}>
            <InlineSkeleton className="h-8 w-10" />
            <InlineSkeleton className="w-14" />
            <InlineSkeleton className="h-2 w-10" />
          </div>
        ))}
      </div>
      <div className={styles.documentStage}>
        <div className={styles.previewTitle} aria-hidden="true">
          <InlineSkeleton className="w-40" />
          <InlineSkeleton className="w-16" />
        </div>
        <div className={styles.preview}>
          <RegistrationDocumentLoading />
        </div>
        <div className={styles.documentActions} aria-hidden="true">
          <InlineSkeleton className="w-28" />
        </div>
      </div>
    </>
  );
}
