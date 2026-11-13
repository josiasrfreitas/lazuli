"use client";

import { useState, type Dispatch, type ReactElement, type SetStateAction } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Check, ExternalLink, FileText, FolderOpen, Plus } from "lucide-react";
import { Button } from "@lazuli/ui";
import { trpc, type QueryResult } from "~/lib/trpc";
import {
  DOCUMENTS,
  statusLabel,
  type DocumentDefinition,
  type DocumentKind,
} from "~/features/student-documents/model";
import { RegistrationDocumentUpload } from "./registration-document-upload";
import { DocumentImage, DocumentThumbnail } from "./registration-document-preview";
import styles from "./student-registration.module.css";
import {
  DOCUMENT_LABELS,
  DOCUMENT_ICONS,
  DocumentsHeader,
  DocumentsLoading,
} from "./registration-documents-loading";
import { PdfPreview } from "~/features/student-documents/pdf-preview";
import { StudentDocumentDeleteButton } from "~/features/student-documents/delete-document-button";

const PROCESSING_POLL_MS = 3000;
type DocumentFile = RouterOutputs["studentDocuments"]["list"][number];
type DocumentSlot = {
  id: string;
  kind: DocumentKind | `custom_${string}`;
  file: DocumentFile | undefined;
};

function documentSlots(files: DocumentFile[]): DocumentSlot[] {
  const standard = DOCUMENTS.flatMap<DocumentSlot>((document) => {
    const matching = files.filter((file) => file.kind === document.id);
    if (matching.length > 0)
      return matching.map((file) => ({ id: file.id, kind: document.id, file }));
    if (document.id === "payment") return [];
    return [{ id: `empty-${document.id}`, kind: document.id, file: undefined }];
  });
  return [
    ...standard,
    ...files
      .filter((file) => file.kind.startsWith("custom_"))
      .map((file) => ({ id: file.id, kind: file.kind as `custom_${string}`, file })),
  ];
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
  const definition: DocumentDefinition | undefined =
    DOCUMENTS.find((document) => document.id === selected?.kind) ??
    (selected?.file
      ? {
          id: selected.kind,
          title: selected.file.title ?? "Documento",
          detail: selected.file.subtitle ?? "",
          extracts: false,
        }
      : undefined);
  const file = selected?.file;
  const processing = file?.status === "RECEIVED" || file?.status === "PROCESSING";
  async function refresh(): Promise<void> {
    const result = await documents.refetch();
    const newest = result.data?.find((item) => item.kind === upload?.id);
    if (newest) setSelectedId(newest.id);
    await utils.studentDocuments.photo.invalidate({ studentId });
    await utils.students.pendingActions.invalidate({ id: studentId });
    await utils.dashboard.invalidate();
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
  const title =
    DOCUMENTS.find((item) => item.id === slot.kind)?.title ?? slot.file?.title ?? "Documento";
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
      <span className={styles.choiceLabel}>
        {DOCUMENT_LABELS[slot.kind as keyof typeof DOCUMENT_LABELS] ??
          slot.file?.title ??
          "Documento"}
      </span>
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
  const Icon = DOCUMENT_ICONS[slot.kind as keyof typeof DOCUMENT_ICONS] ?? FileText;
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
        title={definition?.title ?? file.title ?? "Documento"}
        showOpenLink={false}
      />
    );
  if (file)
    return (
      <DocumentImage
        key={`${file.id}-${file.updatedAt.getTime()}`}
        id={file.id}
        version={file.updatedAt.getTime()}
        title={definition?.title ?? file.title ?? "Documento"}
        photo={file.kind === "photo"}
      />
    );
  return <EmptyDocumentPreview model={model} />;
}

function EmptyDocumentPreview({ model }: { model: DocumentsModel }): ReactElement {
  const { definition, setUpload } = model;
  const Icon =
    definition && definition.id in DOCUMENT_ICONS
      ? DOCUMENT_ICONS[definition.id as keyof typeof DOCUMENT_ICONS]
      : FileText;
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
    <section
      className={styles.documents}
      aria-label="Documentos do aluno"
      aria-busy={model.documents.isPending}
    >
      <DocumentsHeader
        pending={model.documents.isPending}
        count={model.documents.isError ? undefined : model.files.length}
      />
      <DocumentsBody model={model} />
    </section>
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
