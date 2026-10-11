import type { ReactElement, ReactNode } from "react";
import { Alert, Button, InlineSkeleton } from "@lazuli/ui";

export function ProfileLoading(): ReactElement {
  return (
    <div role="status" className="grid gap-4 py-6">
      <InlineSkeleton className="h-8 w-48" />
      <InlineSkeleton className="h-4 w-64" />
      <span className="sr-only">Carregando informações do aluno</span>
    </div>
  );
}
export function ProfileError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}): ReactElement {
  return (
    <Alert variant="destructive">
      <p>{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Tentar novamente
      </Button>
    </Alert>
  );
}
export function ProfileFact({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="grid min-w-0 gap-1">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm font-medium">{children}</dd>
    </div>
  );
}
export function ProfileMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail: string;
}): ReactElement {
  return (
    <div className="grid content-start gap-1 py-2">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="font-numeric text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
      <dd className="text-caption text-muted-foreground">{detail}</dd>
    </div>
  );
}
