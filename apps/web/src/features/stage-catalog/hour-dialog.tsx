"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { GripVertical, Plus, Pencil } from "lucide-react";
import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { ActivityForm, activityLabels } from "./activity-form";
import { firstFormField } from "./editor-form";
import { compactPages, stageContext } from "./labels";
import type { ProgramActivity, StageDetail, TeachingHour, TeachingProgram } from "./types";
import styles from "./workspace.module.css";

export const hourLabel = (hour: TeachingHour): string =>
  "Hora-aula " + String(hour.sequence).padStart(2, "0");
type Edit = { position: number; editing: boolean; hour: TeachingHour };

export function HourDialog({
  stage,
  program,
  unitTitle,
  hour,
  origin,
  onClose,
}: {
  stage: StageDetail;
  program: TeachingProgram;
  unitTitle: string;
  hour: TeachingHour;
  origin: HTMLButtonElement;
  onClose: () => void;
}): React.JSX.Element {
  const [edit, setEdit] = useState<Edit | null>(null);
  const [notice, setNotice] = useState("");
  const returnAction = useRef<string | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const pending = useRef(false);
  const context = stageContext(stage, program) + " · " + unitTitle;
  useLayoutEffect(() => {
    if (edit) firstFormField(form.current)?.focus({ preventScroll: true });
    else if (returnAction.current) {
      const target =
        document.querySelector<HTMLElement>(`#${CSS.escape(returnAction.current)}`) ??
        title.current;
      target?.focus();
    }
  }, [edit]);

  function openForm({ position, editing, trigger }: FormPosition): void {
    setNotice("");
    returnAction.current = trigger.id;
    setEdit({ position, editing, hour });
  }
  const ordering = useActivityOrder({ stage, program, hour, pending, openForm, setNotice });
  function dismiss(): void {
    if (pending.current) return;
    if (edit) setEdit(null);
    else onClose();
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) dismiss();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className={edit ? "md:max-w-3xl" : "md:max-w-xl"}
          motion="subtle"
          initialFocus={() => title.current ?? true}
          finalFocus={() => origin}
        >
          {edit ? (
            <HourEdit
              {...{ stage, program, edit, context, hour, form, pending, setNotice }}
              close={() => setEdit(null)}
            />
          ) : (
            <HourContents {...{ hour, context, title, openForm, ordering }} />
          )}
          <span role="status" aria-atomic="true" className="sr-only">
            {notice}
          </span>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
function pagesLabel({ pageStart, pageEnd }: ProgramActivity): string | null {
  if (pageStart === null) return null;
  if (pageEnd === null || pageEnd === pageStart) return "Pág. " + pageStart;
  return "Págs. " + pageStart + "–" + pageEnd;
}

function activityMeta(activity: ProgramActivity): string {
  const kind = activityLabels[activity.kind];
  return [
    (activity.kind === "LESSON" && activity.lessons.length > 0) ||
    activity.bookTitle.toLocaleLowerCase("pt-BR").startsWith(kind.toLocaleLowerCase("pt-BR"))
      ? null
      : kind,
    /^Páginas? \d+(?:–\d+)?$/.test(activity.bookTitle) ? null : pagesLabel(activity),
    activity.descriptionPending &&
      [activity.sourceCode, "Descrição pendente"].filter(Boolean).join(" · "),
  ]
    .filter(Boolean)
    .join(" · ");
}

function BookPassages({ activity }: { activity: ProgramActivity }): React.JSX.Element {
  const groups = new Map<
    string,
    { title: string; pages: Map<number, string[]>; parts: Set<string> }
  >();
  for (const ref of activity.lessons) {
    let group = groups.get(ref.id);
    if (!group) {
      group = { title: ref.title, pages: new Map(), parts: new Set() };
      groups.set(ref.id, group);
    }
    if (ref.bookPage) {
      const number = ref.bookPage.number;
      const exercises = group.pages.get(number) ?? [];
      if (ref.pageActivity) exercises.push(ref.pageActivity.title);
      group.pages.set(number, exercises);
    } else if (
      ref.part &&
      !activity.bookTitle
        .toLocaleLowerCase("pt-BR")
        .includes(("parte " + ref.part).toLocaleLowerCase("pt-BR"))
    )
      group.parts.add(ref.part);
  }
  return (
    <>
      {Array.from(groups, ([id, group]) => {
        const showTitle =
          activity.bookTitle !== group.title && !activity.bookTitle.startsWith(group.title + " ·");
        const nums = [...group.pages.keys()].toSorted((left, right) => left - right);
        const summary = [showTitle && group.title, ...group.parts, compactPages(nums)]
          .filter(Boolean)
          .join(" · ");
        return (
          <div key={id}>
            {summary && <p>{summary}</p>}
            {nums.map((number) => {
              const titles = group.pages.get(number)!;
              return titles.length > 0 ? (
                <p key={number}>
                  Pág. {number} · {titles.join(", ")}
                </p>
              ) : null;
            })}
          </div>
        );
      })}
    </>
  );
}

type FormPosition = { position: number; editing: boolean; trigger: HTMLButtonElement };
type Placement = { gap: number; trigger: HTMLButtonElement };
type Place = (index: number, placement: Placement) => Promise<void>;
type ActivityOrder = {
  list: React.RefObject<HTMLOListElement | null>;
  slot: number | null;
  orderError: string;
  drag: (index: number) => React.ButtonHTMLAttributes<HTMLButtonElement>;
};
const DRAG_THRESHOLD_PX = 4;
const ORDER_KEYS = new Set(["ArrowUp", "ArrowDown", "Enter", " "]);
const ACTIVATE_KEYS = new Set(["Enter", " "]);
type OrderKeyContext = {
  index: number;
  slot: number | null;
  count: number;
  setSlot: (value: number) => void;
  place: Place;
};
function canMove(position: number, count: number): boolean {
  return position >= 0 && position < count;
}

function handleOrderKey(
  event: React.KeyboardEvent<HTMLButtonElement>,
  { index, slot, count, setSlot, place }: OrderKeyContext,
): void {
  if (!ORDER_KEYS.has(event.key)) return;
  event.preventDefault();
  if (ACTIVATE_KEYS.has(event.key)) {
    if (index < 0) void place(-1, { gap: slot ?? count, trigger: event.currentTarget });
    return;
  }
  const delta = event.key === "ArrowUp" ? -1 : 1;
  if (index < 0) {
    setSlot(Math.max(0, Math.min(count, (slot ?? count) + delta)));
  } else if (canMove(index + delta, count)) {
    void place(index, { gap: index + delta + (delta > 0 ? 1 : 0), trigger: event.currentTarget });
  }
}
type OrderInput = {
  stage: StageDetail;
  program: TeachingProgram;
  hour: TeachingHour;
  pending: React.RefObject<boolean>;
  openForm: (target: FormPosition) => void;
  setNotice: (value: string) => void;
};
function useActivityOrder({
  stage,
  program,
  hour,
  pending,
  openForm,
  setNotice,
}: OrderInput): ActivityOrder {
  const list = useRef<HTMLOListElement>(null);
  const pointer = useRef<{ index: number; startY: number; change: string; active: boolean } | null>(
    null,
  );
  const releaseGap = useRef<number | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [orderError, setOrderError] = useState("");
  const utils = trpc.useUtils();
  const move = trpc.teachingPrograms.editProgram.useMutation();
  async function place(
    index: number,
    { gap, trigger }: { gap: number; trigger: HTMLButtonElement },
  ): Promise<void> {
    setSlot(null);
    if (index < 0) {
      openForm({ position: gap, editing: false, trigger });
      return;
    }
    const position = gap > index ? gap - 1 : gap;
    if (position === index || pending.current) return;
    pending.current = true;
    setOrderError("");
    try {
      await move.mutateAsync({
        action: "moveActivity",
        stageId: stage.id,
        programId: program.id,
        hourId: hour.id,
        expectedChange: hour.lastChange,
        activityId: hour.activities[index]!.id,
        position,
      });
      setNotice("Ordem das atividades salva.");
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : "Não foi possível mover a atividade.");
    } finally {
      try {
        await utils.teachingPrograms.detail.invalidate({ id: stage.id });
      } finally {
        pending.current = false;
      }
    }
  }
  function gapAt(clientY: number): number {
    const rows = [...(list.current?.children ?? [])];
    const index = rows.findIndex((row) => {
      const rect = row.getBoundingClientRect();
      return clientY < rect.top + rect.height / 2;
    });
    return index === -1 ? rows.length : index;
  }
  const input = {
    pending,
    releaseGap,
    pointer,
    slot,
    setSlot,
    place,
    gapAt,
    lastChange: hour.lastChange,
    count: hour.activities.length,
  };
  return { list, slot, orderError, drag: (index) => activityDrag(index, input) };
}
type Gesture = { index: number; startY: number; change: string; active: boolean };
type DragContext = {
  pending: React.RefObject<boolean>;
  releaseGap: React.RefObject<number | null>;
  pointer: React.RefObject<Gesture | null>;
  slot: number | null;
  setSlot: (value: number | null) => void;
  place: Place;
  gapAt: (value: number) => number;
  lastChange: string;
  count: number;
};
function activityDrag(
  index: number,
  { pending, releaseGap, pointer, slot, setSlot, place, gapAt, lastChange, count }: DragContext,
): React.ButtonHTMLAttributes<HTMLButtonElement> {
  return {
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || pending.current) return;
      releaseGap.current = null;
      event.currentTarget.setPointerCapture(event.pointerId);
      pointer.current = { index, startY: event.clientY, change: lastChange, active: false };
    },
    onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => {
      const gesture = pointer.current;
      if (!gesture) return;
      if (Math.abs(event.clientY - gesture.startY) > DRAG_THRESHOLD_PX) gesture.active = true;
      if (gesture.active) setSlot(gapAt(event.clientY));
    },
    onPointerCancel: () => {
      pointer.current = null;
      setSlot(null);
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      const gesture = pointer.current;
      pointer.current = null;
      if (!gesture) return;
      if (gesture.change !== lastChange) {
        setSlot(null);
        return;
      }
      if (index < 0) releaseGap.current = gesture.active ? gapAt(event.clientY) : (slot ?? count);
      else if (gesture.active)
        void place(index, { gap: gapAt(event.clientY), trigger: event.currentTarget });
    },
    onKeyDown: (event) => handleOrderKey(event, { index, slot, count: count, setSlot, place }),
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      if (index < 0) {
        const gap = releaseGap.current ?? slot ?? count;
        releaseGap.current = null;
        void place(-1, { gap, trigger: event.currentTarget });
      }
    },
  };
}
function HourContents({
  hour,
  context,
  title,
  openForm,
  ordering,
}: {
  hour: TeachingHour;
  context: string;
  title: React.RefObject<HTMLHeadingElement | null>;
  openForm: (target: FormPosition) => void;
  ordering: ActivityOrder;
}): React.JSX.Element {
  const { list, slot, drag, orderError } = ordering;
  return (
    <>
      <DialogHeader>
        <DialogTitle tabIndex={-1} ref={title}>
          {hourLabel(hour)}
        </DialogTitle>
        <DialogDescription>
          {context}
          <span className="block">
            Ao inserir uma atividade, redistribua os {hour.durationMinutes} minutos desta hora.
          </span>
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <ol
          ref={list}
          className={styles.hourActivities}
          data-end={slot === hour.activities.length || undefined}
        >
          {hour.activities.map((activity, index) => (
            <HourActivity key={activity.id} {...{ activity, index, slot, drag, openForm }} />
          ))}
        </ol>
        <button type="button" id={hour.id + "-add"} className={styles.addRow} {...drag(-1)}>
          <Plus size={17} /> Adicionar atividade <GripVertical size={17} />
        </button>
        <p className={styles.meta}>Arraste para escolher a posição ou use as setas do teclado.</p>
        {orderError && <p role="alert">{orderError}</p>}
      </DialogBody>
    </>
  );
}

function HourActivity({
  activity,
  index,
  slot,
  drag,
  openForm,
}: {
  activity: ProgramActivity;
  index: number;
  slot: number | null;
  drag: ActivityOrder["drag"];
  openForm: (target: FormPosition) => void;
}): React.JSX.Element {
  return (
    <li className={styles.activity} data-drop={slot === index || undefined}>
      <button
        type="button"
        className={styles.grip}
        aria-label={"Mover " + activity.bookTitle}
        title="Arraste ou use as setas para mover"
        {...drag(index)}
      >
        <GripVertical size={17} />
      </button>
      <div className={styles.activityContent}>
        <strong>{activity.bookTitle}</strong>
        {activityMeta(activity) && <p>{activityMeta(activity)}</p>}
        <BookPassages activity={activity} />
        {activity.instructions && <p className="whitespace-pre-line">{activity.instructions}</p>}
      </div>
      <span className={styles.activityMinutes}>{activity.durationMinutes} min</span>

      <Button
        type="button"
        size="icon-compact-responsive"
        variant="ghost"
        title="Editar atividade"
        id={activity.id + "-edit"}
        aria-label={"Editar " + activity.bookTitle}
        onClick={(event) =>
          openForm({ position: index, editing: true, trigger: event.currentTarget })
        }
      >
        <Pencil />
      </Button>
    </li>
  );
}

function HourEdit({
  stage,
  program,
  edit,
  context,
  hour,
  form,
  pending,
  setNotice,
  close,
}: {
  stage: StageDetail;
  program: TeachingProgram;
  edit: Edit;
  context: string;
  hour: TeachingHour;
  form: React.RefObject<HTMLFormElement | null>;
  pending: React.RefObject<boolean>;
  setNotice: (value: string) => void;
  close: () => void;
}): React.JSX.Element {
  return (
    <ActivityForm
      stage={stage}
      programId={program.id}
      hour={edit.hour}
      position={edit.position}
      editing={edit.editing}
      description={context + " · " + hourLabel(hour) + " · Posição " + (edit.position + 1)}
      form={form}
      pending={pending}
      onSaved={(savedTitle, deleted) =>
        requestAnimationFrame(() =>
          setNotice("A atividade “" + savedTitle + (deleted ? "” foi excluída." : "” foi salva.")),
        )
      }
      close={close}
    />
  );
}
