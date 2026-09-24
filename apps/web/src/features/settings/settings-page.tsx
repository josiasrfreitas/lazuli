"use client";

import type { ReactElement } from "react";

import { Button } from "@lazuli/ui";

import { trpc } from "~/lib/trpc";

import { SettingsPanel } from "./settings-panel";

export function SettingsPage(): ReactElement {
  const utils = trpc.useUtils();
  const query = trpc.finance.readSettings.useQuery();
  const mutation = trpc.finance.saveSettings.useMutation({
    onSuccess: (row) => {
      if (row !== null) utils.finance.readSettings.setData(undefined, row);
    },
  });
  return (
    <div className="mx-auto w-full max-w-xl space-y-3 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="font-display text-h2 font-semibold">Ajustes financeiros</h1>
        <p className="text-control text-muted-foreground">Válidos para novos contratos.</p>
      </header>
      {query.isPending && <p role="status">Carregando ajustes…</p>}
      {query.isError && (
        <div role="alert">
          Não foi possível carregar os ajustes.{" "}
          <Button type="button" variant="link" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {query.data !== undefined && <SettingsPanel row={query.data} mutation={mutation} />}
    </div>
  );
}
