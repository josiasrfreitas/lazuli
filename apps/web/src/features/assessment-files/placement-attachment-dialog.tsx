"use client";

import type { JSX as ReactJSX } from "react";
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
  onUpload: (file: PlacementFile) => Promise<unknown>;
  onClose: () => void;
  onComplete?: () => void;
  kind?: "ORIGINAL" | "CORRECTED";
}): ReactJSX.Element {
  const corrected = kind === "CORRECTED";
  return (
    <FileAttachmentDialog
      open
      compact
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={corrected ? "Anexar prova corrigida" : "Anexar prova de nivelamento"}
      description={
        corrected
          ? "Envie a versão com as correções do professor. Este anexo é opcional."
          : "Envie a prova aplicada para registrar a correção neste atendimento."
      }
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
      successTitle={corrected ? "Prova corrigida anexada" : "Prova anexada"}
      successDescription={
        corrected
          ? "A versão corrigida está disponível junto à prova aplicada neste atendimento."
          : "A prova está disponível. O próximo passo é registrar o estágio indicado na correção."
      }
      doneLabel="Voltar ao atendimento"
      onComplete={onComplete ?? onClose}
      onAttach={async ([file]) => {
        if (!file) return;
        await onUpload({
          id: visit.id,
          kind,
          fileName: file.name,
          contentType: file.type as PlacementFile["contentType"],
          base64: await readFileBase64(file),
        });
      }}
    />
  );
}
