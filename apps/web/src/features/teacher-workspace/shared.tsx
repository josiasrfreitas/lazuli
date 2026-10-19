"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Alert, Button, InlineSkeleton } from "@lazuli/ui";

export function TeacherPage({ title, description, children, back, actions }: {
  title: string; description?: string; children: ReactNode; back?: string; actions?: ReactNode;
}) {
  return <div className="mx-auto grid w-full max-w-5xl content-start gap-6 p-4 pb-8 sm:p-6">
    <header className="grid gap-3">
      {back && <Link href={back} className="flex w-fit items-center gap-1 text-caption text-interactive"><ArrowLeft className="size-4" />Voltar</Link>}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h1 className="font-display text-h2 font-semibold">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>
        {actions}
      </div>
    </header>
    {children}
  </div>;
}

export function TeacherQueryState({ pending, error, retry }: {
  pending: boolean; error: { message: string } | null; retry: () => void;
}) {
  if (pending) return <div className="grid gap-3" aria-label="Carregando" aria-busy="true">{[1, 2, 3].map((key) => <InlineSkeleton key={key} className="h-20 w-full" />)}</div>;
  return error ? <Alert variant="destructive">{error.message}<Button variant="secondary" onClick={retry}>Tentar novamente</Button></Alert> : null;
}

export function TeacherLinkRow({ href, title, children, subtitle, trailing }: { href: string; title: string; children?: ReactNode; subtitle?: string; trailing?: ReactNode }) {
  return <Link href={href} className="flex min-h-16 items-center gap-3 px-4 py-4 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
    <div className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span>
      {(children || subtitle) && <div className="mt-1 text-caption text-muted-foreground">{children ?? subtitle}</div>}</div>
    {trailing}<ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
  </Link>;
}
