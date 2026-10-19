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
import { trpc } from "~/lib/trpc";
import { QrWindowForm } from "./qr-fields";
import { attendanceTime } from "./location";
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
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const utils = trpc.useUtils();
  const open = trpc.studentAttendance.open.useMutation({
    onSuccess: async (result) => {
      setLink(result);
      try { sessionStorage.setItem(`attendance-projection:${sessionId}`, result.projectionToken); } catch { /* The current dialog still carries the projection link. */ }
      await utils.studentAttendance.status.invalidate({ sessionId });
      await utils.activity.invalidate();
    },
  });
  const pending = open.isPending;
  const url = link ? `${window.location.origin}/presenca#${link.token}` : null;
  async function generate(): Promise<void> {
    let projectionToken: string | undefined;
    try { projectionToken = sessionStorage.getItem(`attendance-projection:${sessionId}`) ?? undefined; } catch { /* A new projection capability will be issued. */ }
    open.mutate({ sessionId, minutes: format === "IN_PERSON" ? 5 : minutes, location: null, ...(projectionToken ? { projectionToken } : {}) });
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
                  <div className="grid gap-3 border-t border-border pt-4">
                    <h3 className="text-sm font-semibold">Projetar na tela da sala</h3>
                    <p className="text-caption text-muted-foreground">Abra o endereço abaixo no computador da sala. O QR será atualizado quando você gerar um novo link pelo celular.</p>
                    <a className="break-all text-caption text-interactive underline" target="_blank" rel="noreferrer" href={`/presenca/projecao#${link!.projectionToken}`}>{`${window.location.origin}/presenca/projecao#${link!.projectionToken}`}</a>
                    <Button variant="secondary" onClick={() => { void navigator.clipboard?.writeText(`${window.location.origin}/presenca/projecao#${link!.projectionToken}`).then(() => setCopied(true), () => setCopyError(true)); }}>Copiar acesso da projeção</Button>
                    <Button variant="ghost" disabled={pending} onClick={() => void generate()}>Gerar novo QR / link</Button>
                  </div>
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
