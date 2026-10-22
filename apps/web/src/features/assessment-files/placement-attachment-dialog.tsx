"use client";

import type { JSX as ReactJSX } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { FileAttachmentDialog } from "@lazuli/ui";
import { MAX_PLACEMENT_FILE_BYTES } from "@lazuli/validators";
import { dateLabel, formatLabel } from "~/features/admissions/labels";
import { readFileBase64 } from "./file-transfer";

type PlacementFile = {
  id: string;
  kind?: "ORIGINAL" | "CORRECTED";
  fileName: string;
  contentType: "application/pdf" | "image/jpeg" | "image/png";
  base64: string;
};
type PlacementUpload = (
  file: PlacementFile,
) => Promise<RouterOutputs["admissions"]["placementUpload"]>;
const attachmentCopy = {
  ORIGINAL: {
    title: "Anexar prova de nivelamento",
    description: "Envie a prova aplicada para registrar a correção neste atendimento.",
    successTitle: "Prova anexada",
    successDescription:
      "A prova está disponível. O próximo passo é registrar o estágio indicado na correção.",
  },
  CORRECTED: {
    title: "Anexar prova corrigida",
    description: "Envie a versão com as correções do professor. Este anexo é opcional.",
    successTitle: "Prova corrigida anexada",
    successDescription:
      "A versão corrigida está disponível junto à prova aplicada neste atendimento.",
  },
} as const;

async function attachPlacementFile({
  file,
  visitId,
  kind,
  onUpload,
}: {
  file: File | undefined;
  visitId: string;
  kind: keyof typeof attachmentCopy;
  onUpload: PlacementUpload;
}): Promise<void> {
  if (!file) return;
  await onUpload({
    id: visitId,
    kind,
    fileName: file.name,
    contentType: file.type as PlacementFile["contentType"],
    base64: await readFileBase64(file),
  });
}

export function PlacementAttachmentDialog({
  visit,
  person,
  onUpload,
  onClose,
  onComplete,
  kind = "ORIGINAL",
}: {
  visit: {
    id: string;
    date: Date | string;
    startTime: string;
    endTime: string;
    format: "ONLINE" | "IN_PERSON";
  };
  person: string;
  onUpload: PlacementUpload;
  onClose: () => void;
  onComplete?: () => void;
  kind?: "ORIGINAL" | "CORRECTED";
}): ReactJSX.Element {
  const copy = attachmentCopy[kind];
  return (
    <FileAttachmentDialog
      open
      compact
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={copy.title}
      description={copy.description}
      target={{
        name: person,
        description: "Atendimento de nivelamento",
        detail: `${dateLabel(visit.date)} · ${visit.startTime}–${visit.endTime} · ${formatLabel(visit.format)}`,
      }}
      accept="application/pdf,image/jpeg,image/png"
      acceptLabel="PDF, JPG ou PNG"
      maxSize={MAX_PLACEMENT_FILE_BYTES}
      camera
      submitLabel="Anexar prova"
      successTitle={copy.successTitle}
      successDescription={copy.successDescription}
      doneLabel="Voltar ao atendimento"
      onComplete={onComplete ?? onClose}
      onAttach={([file]) => attachPlacementFile({ file, visitId: visit.id, kind, onUpload })}
    />
  );
}
