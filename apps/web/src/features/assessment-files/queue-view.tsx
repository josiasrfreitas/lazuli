import type { ReactElement } from "react";
import { Button } from "@lazuli/ui";
import { ListChecks, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { removePendingFile } from "./local-queue";
import { COMPLETE_PERCENT, labels, type QueueItem, type QueueViewState } from "./queue-model";
type PanelProps = QueueViewState & { userId: string };
export function UploadQueuePanel(props: PanelProps): ReactElement | null {
  const { items } = props;
  if (items.length === 0 && !props.storageError) return null;
  const activeCount = items.filter((item) => item.status !== "READY").length;
  return (
    <details
      className="shrink-0 border-t border-border bg-card px-4 py-2"
      aria-label="Fila de provas"
    >
      <summary className="flex cursor-pointer items-center gap-2 text-sm">
        <UploadCloud className="size-4" />
        {activeCount
          ? `${activeCount} ${activeCount === 1 ? "envio" : "envios"} para acompanhar`
          : "Provas recebidas"}
      </summary>
      <div className="grid max-h-64 gap-3 overflow-y-auto py-3">
        <QueueNotices {...props} />
        {items.map((item) => (
          <UploadQueueRow key={item.id} {...props} item={item} />
        ))}
        {props.retry.error && (
          <p role="alert" className="text-sm text-destructive">
            {props.retry.error.message}
          </p>
        )}
        {items.some((item) => item.status === "READY" || item.status === "REJECTED") && (
          <ClearQueueButton {...props} />
        )}
      </div>
    </details>
  );
}
function QueueNotices({ storageError, recentError, onRefetch }: PanelProps): ReactElement {
  return (
    <>
      <p className="text-caption text-muted-foreground">
        Você pode continuar navegando. Se fechar ou bloquear o celular, retome os envios
        interrompidos ao voltar.
      </p>
      {storageError && (
        <p role="alert" className="text-sm text-destructive">
          {storageError}
        </p>
      )}
      {recentError && (
        <p role="alert" className="text-caption">
          Não foi possível atualizar o processamento.{" "}
          <Button size="sm" variant="ghost" onClick={onRefetch}>
            <RefreshCw aria-hidden="true" />
            Atualizar
          </Button>
        </p>
      )}
    </>
  );
}
function UploadQueueRow(props: PanelProps & { item: QueueItem }): ReactElement {
  const { item } = props;
  return (
    <div className="grid gap-1 border-t border-border pt-2">
      <p className="break-all text-sm font-medium">{item.name}</p>
      <p className="text-caption text-muted-foreground" role="status">
        {queueStatusLabel(item)}
      </p>
      {item.status === "UPLOADING" && (
        <progress
          className="w-full"
          max={COMPLETE_PERCENT}
          value={item.progress}
          aria-label={`Envio de ${item.name}`}
        />
      )}
      {item.message && <p className="text-caption text-destructive">{item.message}</p>}
      <QueueRecoveryActions {...props} />
      {item.status === "READY" && (
        <a
          className="text-caption text-interactive underline"
          href={`/api/assessment-files/${item.id}`}
        >
          Baixar prova
        </a>
      )}
    </div>
  );
}
function queueStatusLabel(item: QueueItem): string {
  if (item.status !== "UPLOADING") return labels[item.status];
  return item.progress === COMPLETE_PERCENT
    ? "Concluindo recebimento…"
    : `Enviando · ${item.progress}%`;
}
function QueueRecoveryActions({
  item,
  setItems,
  userId,
  retry,
}: PanelProps & { item: QueueItem }): ReactElement {
  return (
    <>
      {item.status === "INTERRUPTED" && item.pending && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setItems((current) =>
                current.map((row) => (row.id === item.id ? { ...row, status: "QUEUED" } : row)),
              )
            }
          >
            <UploadCloud aria-hidden="true" />
            Retomar envio
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void removePendingFile(userId, item.id).then(() =>
                setItems((current) => current.filter((row) => row.id !== item.id)),
              );
            }}
          >
            <Trash2 aria-hidden="true" />
            Descartar cópia local
          </Button>
        </div>
      )}
      {item.status === "FAILED" && item.received && (
        <Button
          size="sm"
          variant="secondary"
          disabled={retry.isPending}
          onClick={() => retry.mutate({ id: item.id })}
        >
          <RefreshCw aria-hidden="true" />
          Tentar processar novamente
        </Button>
      )}
    </>
  );
}
function ClearQueueButton({ items, dismissed, setItems }: PanelProps): ReactElement {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        const finished = items.filter(
          (item) => item.status === "READY" || item.status === "REJECTED",
        );
        for (const item of finished) dismissed.current.add(item.id);
        setItems((current) => current.filter((item) => !dismissed.current.has(item.id)));
      }}
    >
      <ListChecks aria-hidden="true" />
      Limpar concluídos da fila
    </Button>
  );
}
