"use client";
import { useState, type ReactElement } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check } from "lucide-react";
import {
  Alert,
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
} from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import type { AttendanceLocation } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { QrWindowForm } from "./qr-fields";
import { currentAttendanceLocation, attendanceTime } from "./location";
export type QrLink = RouterOutputs["studentAttendance"]["open"];
export function AttendanceQrDialog({
  sessionId,
  format,
  active,
  link,
  setLink,
  onClose,
}: {
  sessionId: string;
  format: "ONLINE" | "IN_PERSON";
  active: boolean;
  link: QrLink | null;
  setLink: (value: QrLink) => void;
  onClose: () => void;
}): ReactElement {
  const [minutes, setMinutes] = useState<10 | 20 | 30>(10);
  const [locating, setLocating] = useState(false);
  const [referenceMissing, setReferenceMissing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const utils = trpc.useUtils();
  const open = trpc.studentAttendance.open.useMutation({
    onSuccess: async (result) => {
      setLink(result);
      await utils.studentAttendance.status.invalidate({ sessionId });
      await utils.activity.invalidate();
    },
  });
  const pending = locating || open.isPending;
  const url = link ? `${window.location.origin}/presenca#${link.token}` : null;
  async function generate(): Promise<void> {
    setLocating(true);
    let location: AttendanceLocation | null = null;
    if (format === "IN_PERSON") {
      try {
        location = await currentAttendanceLocation();
      } catch {
        setReferenceMissing(true);
      }
    }
    setLocating(false);
    open.mutate({ sessionId, minutes, location });
  }
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && !pending) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          initialFocus={() =>
            document.getElementById(url ? "copy-attendance-link" : "qr-duration-10")
          }
        >
          <DialogHeader>
            <DialogTitle>Presença por {format === "ONLINE" ? "link" : "QR"}</DialogTitle>
            <DialogDescription>
              {url
                ? `Receba os envios até ${attendanceTime(link!.expiresAt)} e confira a chamada antes da baixa.`
                : "Compartilhe este acesso somente com os alunos deste encontro."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid gap-5 py-4">
              {url ? (
                <>
                  <div className="flex justify-center">
                    <QRCodeSVG
                      value={url}
                      size={240}
                      marginSize={4}
                      level="M"
                      title="QR para enviar a presença nesta aula"
                    />
                  </div>
                  <Button
                    id="copy-attendance-link"
                    variant="secondary"
                    onClick={() => {
                      if (!navigator.clipboard) {
                        setCopyError(true);
                        return;
                      }
                      void navigator.clipboard.writeText(url).then(
                        () => {
                          setCopied(true);
                          setCopyError(false);
                        },
                        () => setCopyError(true),
                      );
                    }}
                  >
                    {copied ? <Check /> : <Copy />}
                    {copied ? "Link copiado" : "Copiar link"}
                  </Button>
                  {copyError && (
                    <Alert>
                      Não foi possível copiar automaticamente.
                      <code className="mt-2 block break-all">{url}</code>
                    </Alert>
                  )}
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-caption text-interactive underline"
                  >
                    Abrir página do aluno
                  </a>
                  <p className="text-caption text-muted-foreground">
                    O envio do aluno fica disponível para a sua revisão. A presença final será
                    confirmada na baixa.
                  </p>
                </>
              ) : (
                <QrWindowForm
                  minutes={minutes}
                  change={setMinutes}
                  active={active}
                  format={format}
                  submit={() => {
                    if (!pending) void generate();
                  }}
                />
              )}
              {referenceMissing && (
                <p className="text-caption text-muted-foreground">
                  Referência de localização indisponível. Os alunos ainda poderão enviar sua
                  localização para revisão.
                </p>
              )}
              {open.error && <Alert variant="destructive">{open.error.message}</Alert>}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" disabled={pending} onClick={onClose}>
              {url ? "Concluído" : "Cancelar"}
            </Button>
            {!url && (
              <Button form="open-attendance-link" type="submit" disabled={pending}>
                {pending ? "Preparando link…" : "Gerar link"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
