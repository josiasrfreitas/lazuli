"use client";
import { useState, type ReactElement } from "react";
import dynamic from "next/dynamic";
import {
  type LucideIcon,
  Check,
  ExternalLink,
  FileText,
  FileImage,
  IdCard,
  Plus,
  ScrollText,
  Trash2,
} from "lucide-react";
import { Button } from "@lazuli/ui";
import type { UploadCategory } from "~/features/mobile-upload/file-editor";
import { RegistrationDocumentLoading } from "../students/profile/registration-document-preview";
import type { TeacherDocuments } from "./use-teacher-documents";
import { TEACHER_UPLOAD_CATEGORIES } from "./upload-categories";
import shared from "../students/profile/student-registration.module.css";
import styles from "./teacher-documents.module.css";
const PdfPreview = dynamic(
  () => import("~/features/student-documents/pdf-preview").then((module) => module.PdfPreview),
  {
    loading: () => (
      <div className={shared.preview}>
        <RegistrationDocumentLoading label="Carregando PDF…" />
      </div>
    ),
  },
);
const ICONS: Record<string, LucideIcon> = {
  PHOTO: FileImage,
  ID: IdCard,
  CONTRACT: ScrollText,
  OTHER: FileText,
};
type File = TeacherDocuments["files"][number];
type Slot = { id: string; label: string; kind: File["kind"]; file?: File };
export function TeacherDocumentBrowser({
  documents,
  onUpload,
  onRemove,
}: {
  documents: TeacherDocuments;
  onUpload: (category: UploadCategory) => void;
  onRemove: (id: string) => void;
}): ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const slots: Slot[] = TEACHER_UPLOAD_CATEGORIES.flatMap<Slot>((category) => {
    const files = documents.files.filter((file) => file.kind === category.id);
    if (files.length)
      return files.map((file) => ({ id: file.id, label: file.label, kind: file.kind, file }));
    return [{ id: category.id, label: category.label, kind: category.id as File["kind"] }];
  });
  const selected =
    slots.find((slot) => slot.id === selectedId) ??
    slots.find((slot) => slot.file && slot.kind !== "PHOTO") ??
    slots[0]!;
  const category = TEACHER_UPLOAD_CATEGORIES.find((item) => item.id === selected.kind)!;
  const Icon = ICONS[selected.kind] ?? FileText;
  if (documents.loading)
    return (
      <div className={styles.loading} aria-busy="true">
        <RegistrationDocumentLoading />
      </div>
    );
  if (documents.loadError)
    return (
      <div className={styles.loading} role="alert">
        <p>Não foi possível carregar os anexos.</p>
        <Button variant="secondary" size="sm" onClick={() => void documents.refresh()}>
          Tentar novamente
        </Button>
      </div>
    );
  return (
    <>
      <div className={styles.strip} role="group" aria-label="Selecionar documento do professor">
        {slots.map((slot) => {
          const SlotIcon = ICONS[slot.kind] ?? FileText;
          return (
            <button
              key={slot.id}
              type="button"
              className={shared.documentChoice}
              aria-pressed={selected.id === slot.id}
              title={slot.label}
              aria-label={`${slot.label} · ${slot.file ? "Anexado" : "Não anexado"}`}
              onClick={(event) => {
                setSelectedId(slot.id);
                event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
              }}
            >
              <span className={shared.choicePlaceholder}>
                <SlotIcon aria-hidden="true" />
              </span>
              <span className={shared.choiceLabel}>{slot.label}</span>
              <span className={shared.choiceStatus}>
                {slot.file ? (
                  <>
                    <Check aria-hidden="true" />
                    Anexado
                  </>
                ) : (
                  "Não anexado"
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className={shared.documentStage}>
        <div className={shared.previewTitle}>
          <h4>{selected.label}</h4>
          <span className={shared.documentStatus}>{selected.file ? "Anexado" : "Não anexado"}</span>
        </div>
        {selected.file ? (
          <TeacherFilePreview key={selected.file.id} file={selected.file} />
        ) : (
          <div className={shared.preview} data-empty="true">
            <div className={shared.documentPlaceholder}>
              <Icon aria-hidden="true" />
              <div>
                <p>Adicione este documento ao cadastro</p>
                <span>
                  {category.customLabel
                    ? "Escolha um título para identificar o anexo."
                    : "Envie pelo computador ou pela câmera do celular."}
                </span>
              </div>
              <Button size="compact-responsive" onClick={() => onUpload(category)}>
                <Plus aria-hidden="true" />
                Anexar documento
              </Button>
            </div>
          </div>
        )}
        {selected.file && (
          <div className={shared.documentActions}>
            <a
              className={shared.original}
              href={`/api/teacher-files/${selected.file.id}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink aria-hidden="true" />
              Abrir original
            </a>
            <Button variant="ghost" size="sm" onClick={() => onUpload(category)}>
              {selected.kind === "PHOTO" ? "Trocar foto" : "Adicionar outro"}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remover ${selected.label}`}
              onClick={() => onRemove(selected.file!.id)}
            >
              <Trash2 />
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
function TeacherFilePreview({ file }: { file: File }): ReactElement {
  const [state, setState] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  const src = `/api/teacher-files/${file.id}?retry=${attempt}`;
  if (file.contentType === "application/pdf")
    return <PdfPreview src={src} title={file.label} showOpenLink={false} />;
  return (
    <div className={shared.preview} data-photo={file.kind === "PHOTO"}>
      {state === "loading" && <RegistrationDocumentLoading label="Carregando imagem…" />}
      {state === "error" ? (
        <div className={shared.empty} role="alert">
          <p>Não foi possível abrir a imagem.</p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setState("loading");
              setAttempt((value) => value + 1);
            }}
          >
            Tentar novamente
          </Button>
        </div>
      ) : (
        <img
          src={src}
          alt={file.label}
          data-loaded={state === "ready"}
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
        />
      )}
    </div>
  );
}
