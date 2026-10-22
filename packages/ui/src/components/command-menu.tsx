"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
  type KeyboardEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Combobox } from "@base-ui/react/combobox";
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, CornerDownLeft, Search, X } from "lucide-react";
import { Button } from "./button";
import { InlineSkeleton } from "./inline-skeleton";

export type CommandMenuItem = {
  id: string;
  label: string;
  description: string;
  group: string;
  icon: ReactNode;
  hint?: string | undefined;
  expandable?: boolean;
};
export type CommandMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
  query: string;
  onQueryChange: (query: string) => void;
  items: readonly CommandMenuItem[];
  onSelect: (id: string) => void;
  onExpand: (id: string) => void;
  onBack: () => void;
  scope?: { title: string; description: string } | undefined;
  pending?: boolean;
  error?: boolean;
  onRetry: () => void;
};

export function CommandMenu(props: CommandMenuProps): ReactElement {
  const input = useRef<HTMLInputElement>(null);
  const [highlightedId, setHighlightedId] = useState<string | undefined>();
  const highlighted = props.items.find((item) => item.id === highlightedId) ?? props.items[0];
  useEffect(() => {
    if (props.open) input.current?.focus();
  }, [props.open, props.scope?.title]);
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Trigger render={props.trigger} />
      <Dialog.Portal>
        <Dialog.Backdrop className="lz-command-backdrop" />
        <CommandPopup state={{ props, input, highlighted, setHighlightedId }} />
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type CommandState = {
  props: CommandMenuProps;
  input: RefObject<HTMLInputElement | null>;
  highlighted: CommandMenuItem | undefined;
  setHighlightedId: Dispatch<SetStateAction<string | undefined>>;
};
function CommandPopup({ state }: { state: CommandState }): ReactElement {
  const { props, input } = state;
  return (
    <Dialog.Popup
      className="lz-command-menu"
      initialFocus={input}
      onKeyDownCapture={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (props.scope) props.onBack();
          else props.onOpenChange(false);
        }
      }}
    >
      <Dialog.Title className="sr-only">Buscar e navegar pelo sistema</Dialog.Title>
      <Dialog.Description className="sr-only">
        Use as setas para escolher um resultado, Enter para abrir e a seta para a direita para ver
        os atalhos de um aluno.
      </Dialog.Description>
      <CommandCombobox state={state} />
      <CommandFooter state={state} />
    </Dialog.Popup>
  );
}
function CommandCombobox({ state }: { state: CommandState }): ReactElement {
  const { props, setHighlightedId } = state;
  return (
    <Combobox.Root<CommandMenuItem>
      key={props.scope?.title ?? "global"}
      inline
      open
      autoHighlight
      loopFocus
      items={props.items}
      filter={null}
      value={null}
      inputValue={props.query}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(left, right) => left.id === right.id}
      onItemHighlighted={(item) => setHighlightedId(item?.id)}
      onValueChange={(item) => {
        if (item) props.onSelect(item.id);
      }}
    >
      <CommandSearch state={state} />
      {props.scope && (
        <div className="lz-command-scope">
          <strong>{props.scope.title}</strong>
          <span>{props.scope.description}</span>
        </div>
      )}
      <CommandItems props={props} />
      <CommandMessages props={props} />
    </Combobox.Root>
  );
}
function CommandSearch({ state }: { state: CommandState }): ReactElement {
  const { props, input } = state;
  return (
    <div className="lz-command-search">
      {props.scope ? (
        <Button variant="ghost" size="icon-sm" onClick={props.onBack} aria-label="Voltar à busca">
          <ArrowLeft />
        </Button>
      ) : (
        <Search aria-hidden="true" />
      )}
      <Combobox.Input
        ref={input}
        className="lz-command-input"
        aria-label={props.scope ? `Buscar atalhos de ${props.scope.title}` : "Buscar no sistema"}
        placeholder={props.scope ? "Escolha um destino…" : "Buscar páginas, alunos, turmas…"}
        autoComplete="off"
        spellCheck={false}
        maxLength={100}
        onChange={(event) => props.onQueryChange(event.target.value)}
        onKeyDown={(event) => handleInputKey(event, state)}
      />
      <Dialog.Close render={<Button variant="ghost" size="icon-sm" aria-label="Fechar busca" />}>
        <X />
      </Dialog.Close>
    </div>
  );
}
function handleInputKey(event: KeyboardEvent<HTMLInputElement>, state: CommandState): void {
  const { props, highlighted } = state;

  if (event.nativeEvent.isComposing) return;
  if (
    event.key === "ArrowRight" &&
    highlighted?.expandable &&
    event.currentTarget.selectionStart === props.query.length &&
    event.currentTarget.selectionEnd === props.query.length
  ) {
    event.preventDefault();
    props.onExpand(highlighted.id);
  }
  if (event.key === "ArrowLeft" && props.scope && props.query === "") {
    event.preventDefault();
    props.onBack();
  }
}
function CommandItems({ props }: { props: CommandMenuProps }): ReactElement {
  return (
    <Combobox.List
      className="lz-command-list"
      aria-label={props.scope ? "Atalhos disponíveis" : "Resultados da busca"}
    >
      {(item: CommandMenuItem, index: number) => (
        <div key={item.id}>
          {(index === 0 || props.items[index - 1]?.group !== item.group) && (
            <div className="lz-command-group" aria-hidden="true">
              {item.group}
            </div>
          )}
          <Combobox.Item value={item} className="lz-command-item">
            <span className="lz-command-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="lz-command-copy">
              <span>{item.label}</span>
              <small>{item.description}</small>
            </span>
            <span className="lz-command-hint" aria-hidden="true">
              {item.hint}
              {item.expandable && <ArrowRight />}
            </span>
          </Combobox.Item>
        </div>
      )}
    </Combobox.List>
  );
}
function CommandMessages({ props }: { props: CommandMenuProps }): ReactElement {
  return (
    <>
      {props.pending && (
        <div className="lz-command-pending" role="status">
          <InlineSkeleton className="h-4 w-40" />
          <span>Buscando pessoas e turmas…</span>
        </div>
      )}
      {props.error && (
        <div className="lz-command-message" role="alert">
          <span>
            Não foi possível buscar pessoas e turmas. Os atalhos de páginas continuam disponíveis.
          </span>
          <Button variant="link" size="sm" onClick={props.onRetry}>
            Tentar novamente
          </Button>
        </div>
      )}
      {props.items.length === 0 && !props.pending && !props.error && (
        <div className="lz-command-message" role="status">
          <strong>Nenhum resultado encontrado</strong>
          <span>Tente parte do nome, uma turma ou uma página, como “finanças”.</span>
        </div>
      )}
    </>
  );
}
function CommandFooter({ state }: { state: CommandState }): ReactElement {
  const { props, highlighted } = state;
  return (
    <footer className="lz-command-footer">
      <span>
        <kbd>
          <ArrowUp />
          <ArrowDown />
        </kbd>{" "}
        navegar
      </span>
      <span>
        <kbd>
          <CornerDownLeft />
        </kbd>{" "}
        abrir
      </span>
      {highlighted?.expandable ? (
        <Button size="sm" variant="ghost" onClick={() => props.onExpand(highlighted.id)}>
          Atalhos do aluno <ArrowRight />
        </Button>
      ) : (
        <span className="lz-command-escape">
          <kbd>esc</kbd> {props.scope ? "voltar" : "fechar"}
        </span>
      )}
    </footer>
  );
}
