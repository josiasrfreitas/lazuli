import type { Prisma } from "@lazuli/db";
import { badRequest } from "../trpc/errors.js";
import { lockProgramStage } from "./import.js";
import type { BookContentCommand } from "./catalog-editor.js";

const activeSequence = { where: { deletedAt: null }, orderBy: { sequence: "asc" } } as const;
const entry = { id: true, title: true, sequence: true } as const;
const pages = {
  where: { deletedAt: null },
  orderBy: { number: "asc" },
  select: { id: true, number: true, activities: { ...activeSequence, select: entry } },
} as const;
export const bookLessonSelect = {
  ...entry,
  pages,
  parts: {
    ...activeSequence,
    select: {
      ...entry,
      pages: {
        where: { deletedAt: null },
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          activities: { ...activeSequence, select: entry },
        },
      },
    },
  },
} satisfies Prisma.BookLessonSelect;

type Tx = Prisma.TransactionClient;
export async function saveBookContent(tx: Tx, input: BookContentCommand): Promise<{ id: string }> {
  await lockProgramStage(tx, input.stageId);
  const { lessonId } = input;
  const lesson = await tx.bookLesson.findFirst({
    where: {
      id: lessonId,
      stageId: input.stageId,
      stage: { deletedAt: null, track: { deletedAt: null, productLine: { deletedAt: null } } },
    },
    select: { id: true },
  });
  if (!lesson) throw badRequest("Escolha uma lição deste livro.");
  if (input.action === "pages") {
    const { start, end } = input;
    if (end < start) throw badRequest("A página final deve ser igual ou maior que a inicial.");
    if (end - start >= 5000) throw badRequest("Adicione até 5.000 páginas por vez.");
    const existing = await tx.bookLessonPage.findMany({
      where: { lessonId, number: { gte: start, lte: end } },
      select: { number: true },
    });
    const found = new Set(existing.map((page) => page.number));
    const data = [];
    for (let number = start; number <= end; number++)
      if (!found.has(number)) data.push({ lessonId, number });
    if (data.length) await tx.bookLessonPage.createMany({ data });
    return { id: lessonId };
  }
  if (input.action === "part") return savePart(tx, input);
  if (
    input.partId &&
    !(await tx.bookLessonPart.findFirst({
      where: { id: input.partId, lessonId },
      select: { id: true },
    }))
  )
    throw badRequest("Escolha uma parte desta lição.");
  if (input.action === "page") return savePage(tx, input);
  const page = await tx.bookLessonPage.findFirst({
    where: { id: input.pageId, lessonId, ...(input.partId ? { partId: input.partId } : {}) },
    select: { id: true },
  });
  if (!page) throw badRequest("Escolha uma página desta parte.");
  const pageId = page.id;
  const data = { title: input.title };
  if (input.pageActivityId)
    return tx.bookPageActivity.update({
      where: { id: input.pageActivityId, pageId, deletedAt: null },
      data,
      select: { id: true },
    });
  const last = await tx.bookPageActivity.aggregate({
    where: { pageId, deletedAt: {} },
    _max: { sequence: true },
  });
  return tx.bookPageActivity.create({
    data: { ...data, pageId, sequence: (last._max.sequence ?? 0) + 1 },
    select: { id: true },
  });
}

async function savePart(
  tx: Tx,
  input: Extract<BookContentCommand, { action: "part" }>,
): Promise<{ id: string }> {
  const { lessonId, title, partId } = input;
  const duplicate = await tx.bookLessonPart.findFirst({
    where: { lessonId, title: { equals: title, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicate && duplicate.id !== partId)
    throw badRequest("Esta lição já tem uma parte com esse título.");
  if (partId)
    return tx.bookLessonPart.update({
      where: { id: partId, lessonId, deletedAt: null },
      data: { title },
      select: { id: true },
    });
  const last = await tx.bookLessonPart.aggregate({
    where: { lessonId, deletedAt: {} },
    _max: { sequence: true },
  });
  return tx.bookLessonPart.create({
    data: { lessonId, title, sequence: (last._max.sequence ?? 0) + 1 },
    select: { id: true },
  });
}

async function savePage(
  tx: Tx,
  input: Extract<BookContentCommand, { action: "page" }>,
): Promise<{ id: string }> {
  const { partId, number, pageId } = input;
  const duplicate = await tx.bookLessonPage.findFirst({
    where: { lessonId: input.lessonId, ...(partId ? { partId } : {}), number },
    select: { id: true },
  });
  if (duplicate && duplicate.id !== pageId)
    throw badRequest("Esta página já existe na parte selecionada.");
  if (pageId)
    return tx.bookLessonPage.update({
      where: {
        id: pageId,
        lessonId: input.lessonId,
        ...(partId ? { partId } : {}),
        deletedAt: null,
      },
      data: { number },
      select: { id: true },
    });
  return tx.bookLessonPage.create({
    data: { lessonId: input.lessonId, partId: partId ?? null, number },
    select: { id: true },
  });
}
