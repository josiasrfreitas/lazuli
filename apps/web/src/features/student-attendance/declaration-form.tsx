"use client";
import type { ReactElement } from "react";
import { ArrowRight, CircleAlert, MapPin } from "lucide-react";
import { Alert, Button } from "@lazuli/ui";
import { StudentNameField, StudentNameChoices } from "./student-fields";
import { StudentReceipt } from "./receipt";
import type { LinkInfo } from "./public-link";
import { useDeclaration, type DeclarationModel } from "./declaration-model";
export function DeclarationForm({ token, info }: { token: string; info: LinkInfo }): ReactElement {
  const model = useDeclaration(token, info);
  if (model.receipt) return <StudentReceipt receipt={model.receipt} />;
  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (model.canSubmit) void model.send();
      }}
    >
      <DeclarationIdentity model={model} />
      <DeclarationAction model={model} />
      <aside
        className="flex gap-2.5 border-t border-border pt-4 text-caption text-muted-foreground"
        aria-label="Atenção"
      >
        <CircleAlert className="size-4 shrink-0" aria-hidden />
        <p>
          Confirme somente seu próprio nome. Este navegador só pode enviar uma pessoa nesta aula;
          confirmar outro nome impede a sua própria confirmação. O professor revisará a chamada.
        </p>
      </aside>
    </form>
  );
}
function DeclarationIdentity({ model }: { model: DeclarationModel }): ReactElement {
  return (
    <>
      <StudentNameField
        name={model.name}
        change={model.change}
        error={null}
        disabled={model.pending}
        hint="Digite pelo menos três letras. A busca é automática."
      />
      {model.searching && (
        <p role="status" className="text-sm text-muted-foreground">
          Buscando seu nome…
        </p>
      )}
      {model.result?.matches && (
        <StudentNameChoices
          matches={model.result.matches}
          selected={model.selected}
          select={model.setSelected}
          disabled={model.pending}
        />
      )}
      {model.result?.error && (
        <Alert variant="destructive">
          {model.result.error}
          <Button type="button" variant="ghost" onClick={model.retry}>
            Tentar novamente
          </Button>
        </Alert>
      )}
    </>
  );
}
function DeclarationAction({ model }: { model: DeclarationModel }): ReactElement {
  let label = "Enviar minha presença";
  if (model.locating) label = "Obtendo localização…";
  else if (model.sending) label = "Enviando…";
  return (
    <>
      {model.selected && model.format === "IN_PERSON" && (
        <p className="flex items-start gap-2 text-caption text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden />
          <span>Ao confirmar, permita sua localização para verificar que você está na escola.</span>
        </p>
      )}
      {model.error && <Alert variant="destructive">{model.error}</Alert>}
      <Button size="compact-responsive" type="submit" disabled={!model.canSubmit}>
        {label}
        <ArrowRight aria-hidden />
      </Button>
    </>
  );
}
