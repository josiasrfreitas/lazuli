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
      const target = document.getElementById(returnAction.current) ?? title.current;
      target?.focus();
    }
  }, [edit]);

  function openForm(position: number, editing: boolean, trigger: HTMLButtonElement): void {
    setNotice("");
    returnAction.current = trigger.id;
    setEdit({ position, editing, hour });
  }
  const list = useRef<HTMLOListElement>(null);
  const pointer = useRef<{ index: number; y: number; change: string; active: boolean } | null>(
    null,
  );
  const releaseGap = useRef<number | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [orderError, setOrderError] = useState("");
  const utils = trpc.useUtils();
  const move = trpc.teachingPrograms.editProgram.useMutation();
  async function place(index: number, gap: number, trigger: HTMLButtonElement) {
    setSlot(null);
    if (index < 0) {
      openForm(gap, false, trigger);
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
  function gapAt(y: number) {
    const rows = Array.from(list.current?.children ?? []);
    const index = rows.findIndex((row) => {
      const rect = row.getBoundingClientRect();
      return y < rect.top + rect.height / 2;
    });
    return index < 0 ? rows.length : index;
  }
  function drag(index: number) {
    return {
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        if (e.button !== 0 || pending.current) return;
        releaseGap.current = null;
        e.currentTarget.setPointerCapture(e.pointerId);
        pointer.current = { index, y: e.clientY, change: hour.lastChange, active: false };
      },
      onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
        const p = pointer.current;
        if (!p) return;
        if (Math.abs(e.clientY - p.y) > 4) p.active = true;
        if (p.active) setSlot(gapAt(e.clientY));
      },
      onPointerCancel: () => {
        pointer.current = null;
        setSlot(null);
      },
      onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
        const p = pointer.current;
        pointer.current = null;
        if (!p) return;
        if (p.change !== hour.lastChange) {
          setSlot(null);
          return;
        }
        if (index < 0)
          releaseGap.current = p.active ? gapAt(e.clientY) : (slot ?? hour.activities.length);
        else if (p.active) void place(index, gapAt(e.clientY), e.currentTarget);
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (!["ArrowUp", "ArrowDown", "Enter", " "].includes(e.key)) return;
        e.preventDefault();
        if (e.key === "Enter" || e.key === " ") {
          if (index < 0) void place(-1, slot ?? hour.activities.length, e.currentTarget);
          return;
        }
        const delta = e.key === "ArrowUp" ? -1 : 1;
        if (index < 0) {
          setSlot(
            Math.max(0, Math.min(hour.activities.length, (slot ?? hour.activities.length) + delta)),
          );
        } else if (index + delta >= 0 && index + delta < hour.activities.length) {
          void place(index, index + delta + (delta > 0 ? 1 : 0), e.currentTarget);
        }
      },
      onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
        if (index < 0) {
          const gap = releaseGap.current ?? slot ?? hour.activities.length;
          releaseGap.current = null;
          void place(-1, gap, e.currentTarget);
        }
      },
    };
  }
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
          className={edit ? "md:max-w-md" : "md:max-w-xl"}
          motion="subtle"
          initialFocus={() => title.current ?? true}
          finalFocus={() => origin}
        >
          {edit ? (
            <ActivityForm
              stage={stage}
              programId={program.id}
              hour={edit.hour}
              position={edit.position}
              editing={edit.editing}
              description={context + " · " + hourLabel(hour) + " · Posição " + (edit.position + 1)}
              form={form}
              pending={pending}
              onSaved={(savedTitle) =>
                requestAnimationFrame(() =>
                  setNotice("A atividade “" + savedTitle + "” foi salva."),
                )
              }
              close={() => setEdit(null)}
            />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle tabIndex={-1} ref={title}>
                  {hourLabel(hour)}
                </DialogTitle>
                <DialogDescription>
                  {context}
                  <span className="block">
                    Ao inserir uma atividade, redistribua os {hour.durationMinutes} minutos desta
                    hora.
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
                    <li
                      className={styles.activity}
                      key={activity.id}
                      data-drop={slot === index || undefined}
                    >
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
                      </div>
                      <span className={styles.activityMinutes}>{activity.durationMinutes} min</span>

                      <Button
                        type="button"
                        size="icon-compact-responsive"
                        variant="ghost"
                        title="Editar atividade"
                        id={activity.id + "-edit"}
                        aria-label={"Editar " + activity.bookTitle}
                        onClick={(event) => openForm(index, true, event.currentTarget)}
                      >
                        <Pencil />
                      </Button>
                    </li>
                  ))}
                </ol>
                <button type="button" id={hour.id + "-add"} className={styles.addRow} {...drag(-1)}>
                  <Plus size={17} /> Adicionar atividade <GripVertical size={17} />
                </button>
                <p className={styles.meta}>
                  Arraste para escolher a posição ou use as setas do teclado.
                </p>
                {orderError && <p role="alert">{orderError}</p>}
              </DialogBody>
            </>
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
      const n = ref.bookPage.number;
      const exercises = group.pages.get(n) ?? [];
      if (ref.pageActivity) exercises.push(ref.pageActivity.title);
      group.pages.set(n, exercises);
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
        const nums = [...group.pages.keys()].sort((a, b) => a - b);
        const showPages =
          groups.size > 1 ||
          nums.some(
            (n) =>
              activity.pageStart === null ||
              n < activity.pageStart ||
              n > (activity.pageEnd ?? activity.pageStart),
          );
        const summary = [showTitle && group.title, ...group.parts, showPages && compactPages(nums)]
          .filter(Boolean)
          .join(" · ");
        return (
          <div key={id}>
            {summary && <p>{summary}</p>}
            {nums.map((n) => {
              const titles = group.pages.get(n)!;
              return titles.length ? (
                <p key={n}>
                  Pág. {n} · {titles.join(", ")}
                </p>
              ) : null;
            })}
          </div>
        );
      })}
    </>
  );
}
