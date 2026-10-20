"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Alert, Button } from "@lazuli/ui";
import { QueryLoading } from "~/components/query-loading";
import styles from "./workspace.module.css";

export function TeacherPage({
  title,
  description,
  children,
  back,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  back?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        {back && (
          <Link href={back} aria-label="Voltar" className={styles.back}>
            <ArrowLeft className="size-4" />
          </Link>
        )}
        <div className={styles.identity}>
          <div className="min-w-0">
            <h1 className={styles.title}>{title}</h1>
            {description && <p className={styles.description}>{description}</p>}
          </div>
          {actions}
        </div>
      </header>
      {children}
    </div>
  );
}

export function TeacherQueryState({
  pending,
  error,
  retry,
  loading,
  label = "Carregando",
}: {
  pending: boolean;
  error: { message: string } | null;
  retry: () => void;
  loading?: ReactNode;
  label?: string;
}) {
  if (pending) return loading ?? <QueryLoading label={label} />;
  return error ? (
    <Alert variant="destructive">
      {error.message}
      <Button variant="secondary" onClick={retry}>
        <RefreshCw aria-hidden="true" />
        Tentar novamente
      </Button>
    </Alert>
  ) : null;
}

export function TeacherLinkRow({
  href,
  title,
  children,
  subtitle,
  trailing,
  leading,
}: {
  href: string;
  title: string;
  children?: ReactNode;
  subtitle?: string;
  trailing?: ReactNode;
  leading?: ReactNode;
}) {
  return (
    <Link href={href} className={styles.row}>
      {leading}
      <div className={styles.rowIdentity}>
        <span className={styles.rowTitle}>{title}</span>
        {(children || subtitle) && <div className={styles.rowSubtitle}>{children ?? subtitle}</div>}
      </div>
      {trailing}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
