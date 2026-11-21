import { randomUUID } from "node:crypto";
import type { DatabaseClient, Prisma } from "@lazuli/db";
import { z } from "@lazuli/validators";
import { bookPageRange, DEFAULT_TEACHING_MODALITY, TEACHING_HOUR_MINUTES } from "@lazuli/domain";
import { badRequest, notFound } from "../trpc/errors.js";
import { lockProgramStage } from "./import.js";
import { bookPageNumber, id, MAX_PART_LENGTH, title } from "./catalog-editor.js";
import { bookLessonSelect } from "./book-content.js";

const MAX_INSTRUCTIONS_LENGTH = 5000;
const EDIT_TIMEOUT_MS = 15_000;
type Tx = Prisma.TransactionClient;
const newUnit = { unitTitle: title, assessmentTitle: title };
const minute = z.number().int().min(1).max(TEACHING_HOUR_MINUTES);
const page = bookPageNumber.nullable();
const lessonReference = z.object({
  id,
  part: z.string().trim().max(MAX_PART_LENGTH),
  partId: id.nullish(),
  pageId: id.nullish(),
  pageActivityId: id.nullish(),
});
const kinds = z.enum(["LESSON", "VIDEO", "REVIEW", "INTRODUCTION", "ACTIVITY", "ASSESSMENT"]);
export const programCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    stageId: id,
    scheduleType: z.enum(["REGULAR", "PERSONALIZED"]),
    ...newUnit,
  }),
  z.object({ action: z.literal("renameUnit"), stageId: id, programId: id, unitId: id, title }),
  z.object({ action: z.literal("unit"), stageId: id, programId: id, ...newUnit }),
  z.object({
    action: z.literal("hour"),
    stageId: id,
    programId: id,
    unitId: id,
    lessonId: id.nullable(),
    title,
  }),
  z.object({
    action: z.literal("deleteActivity"),
    stageId: id,
    programId: id,
    hourId: id,
    activityId: id,
    expectedChange: z.string(),
    others: z.array(z.object({ id, minutes: minute })).max(TEACHING_HOUR_MINUTES),
  }),
  z.object({
    action: z.literal("moveActivity"),
    stageId: id,
    programId: id,
    hourId: id,
    activityId: id,
    position: z.number().int().nonnegative(),
    expectedChange: z.string(),
  }),
  z.object({
    action: z.literal("activity"),
    resolvePages: z.boolean().optional(),
    instructions: z.string().trim().max(MAX_INSTRUCTIONS_LENGTH).nullable().optional(),
    stageId: id,
    programId: id,
    hourId: id,
    expectedChange: z.string(),
    activityId: id.nullable(),
    position: z.number().int().nonnegative(),
    title,
    kind: kinds,
    durationMinutes: minute,
    pageStart: page,
    pageEnd: page,
    lessons: z.array(lessonReference),
    others: z.array(z.object({ id, minutes: minute })).max(TEACHING_HOUR_MINUTES),
  }),
]);
type Command = z.infer<typeof programCommand>;
type ActivityCommand = Extract<Command, { action: "activity" }>;

export function editProgram(db: DatabaseClient, input: Command): Promise<{ id: string }> {
  return db.$transaction(
    async (tx) => {
      await lockProgramStage(tx, input.stageId);
      const stage = await tx.stage.findFirst({
        where: { id: input.stageId, track: { deletedAt: null, productLine: { deletedAt: null } } },
        select: { id: true, name: true },
      });
      if (!stage) throw notFound("Estágio indisponível.");
      if (input.action === "start") return startProgram(tx, { stage, input });
      const program = await tx.teachingProgram.findFirst({
        where: { id: input.programId, stageId: stage.id, retiredAt: null },
      });
      if (!program) throw notFound("Esta programação não está disponível para edição.");
      if (input.action === "renameUnit")
        await tx.programUnit.update({
          where: { id: input.unitId, programId: program.id, deletedAt: null },
          data: { title: input.title },
        });
      if (input.action === "unit") await addUnit(tx, { ...input, programId: program.id });
      if (input.action === "hour") await addHour(tx, input);
      if (input.action === "deleteActivity") await deleteActivity(tx, input);
      if (input.action === "moveActivity") await moveActivity(tx, input);
      if (input.action === "activity") await saveActivity(tx, input);
      return { id: program.id };
    },
    { timeout: EDIT_TIMEOUT_MS },
  );
}
async function addUnit(
  tx: Tx,
  { programId, ...input }: { programId: string; unitTitle: string; assessmentTitle: string },
): Promise<void> {
  const query = { where: { programId, deletedAt: {} }, _max: { sequence: true } } as const;
  const units = await tx.programUnit.aggregate(query);
  const hours = await tx.teachingHour.aggregate(query);
  const activities = await tx.programActivity.aggregate(query);
  const assessments = await tx.programAssessment.aggregate(query);
  const unit = await tx.programUnit.create({
    data: {
      programId,
      sourceKey: randomUUID(),
      sequence: (units._max.sequence ?? 0) + 1,
      title: input.unitTitle,
    },
  });
  const assessment = await tx.programAssessment.create({
    data: {
      programId,
      unitId: unit.id,
      sourceKey: randomUUID(),
      title: input.assessmentTitle,
      sequence: (assessments._max.sequence ?? 0) + 1,
    },
  });
  const hour = await tx.teachingHour.create({
    data: {
      programId,
      sequence: (hours._max.sequence ?? 0) + 1,
      sourceKey: randomUUID(),
      durationMinutes: TEACHING_HOUR_MINUTES,
    },
  });
  await tx.programActivity.create({
    data: {
      programId,
      unitId: unit.id,
      teachingHourId: hour.id,
      assessmentId: assessment.id,
      sequence: (activities._max.sequence ?? 0) + 1,
      kind: "ASSESSMENT",
      sourceKey: randomUUID(),
      durationMinutes: TEACHING_HOUR_MINUTES,
      title: input.assessmentTitle,
    },
  });
}
// Move the suffix out of its range first so unique positions hold throughout the transaction.
async function makeRoom(
  tx: Tx,
  {
    table,
    programId,
    position,
  }: { table: "TeachingHour" | "ProgramActivity"; programId: string; position: number },
): Promise<void> {
  const rows =
    table === "TeachingHour"
      ? await tx.teachingHour.aggregate({
          where: { programId, deletedAt: {} },
          _max: { sequence: true },
        })
      : await tx.programActivity.aggregate({
          where: { programId, deletedAt: {} },
          _max: { sequence: true },
        });
  const offset = (rows._max.sequence ?? 0) + 1;
  if (position >= offset) return;
  if (table === "TeachingHour") {
    await tx.teachingHour.updateMany({
      where: { programId, sequence: { gte: position } },
      data: { sequence: { increment: offset } },
    });
    await tx.teachingHour.updateMany({
      where: { programId, sequence: { gte: position + offset } },
      data: { sequence: { decrement: offset - 1 } },
    });
  } else {
    await tx.programActivity.updateMany({
      where: { programId, sequence: { gte: position } },
      data: { sequence: { increment: offset } },
    });
    await tx.programActivity.updateMany({
      where: { programId, sequence: { gte: position + offset } },
      data: { sequence: { decrement: offset - 1 } },
    });
  }
}
async function addHour(tx: Tx, input: Extract<Command, { action: "hour" }>): Promise<void> {
  const { programId, unitId } = input;
  const exams = await tx.programActivity.findMany({
    where: { programId, unitId, kind: "ASSESSMENT" },
    orderBy: { sequence: "asc" },
    include: { teachingHour: true },
  });
  const anchor = input.lessonId ? exams[0] : exams.at(-1);
  if (!anchor) throw badRequest("A prova desta unidade não foi encontrada.");
  const firstInHour = await tx.programActivity.findFirstOrThrow({
    where: { teachingHourId: anchor.teachingHourId },
    orderBy: { sequence: "asc" },
  });
  const position = input.lessonId ? firstInHour.sequence : anchor.sequence + 1;
  const hourPosition = anchor.teachingHour.sequence + (input.lessonId ? 0 : 1);
  if (input.lessonId) await assertLessons(tx, { stageId: input.stageId, ids: [input.lessonId] });
  await makeRoom(tx, { table: "TeachingHour", programId, position: hourPosition });
  await makeRoom(tx, { table: "ProgramActivity", programId, position });
  const hour = await tx.teachingHour.create({
    data: { programId, sourceKey: randomUUID(), sequence: hourPosition, durationMinutes: 60 },
  });
  await tx.programActivity.create({
    data: {
      programId,
      unitId,
      teachingHourId: hour.id,
      sequence: position,
      kind: input.lessonId ? "LESSON" : "ASSESSMENT",
      assessmentId: input.lessonId ? null : anchor.assessmentId,
      sourceKey: randomUUID(),
      title: input.title,
      durationMinutes: TEACHING_HOUR_MINUTES,
      ...(input.lessonId ? { lessons: { create: { lessonId: input.lessonId } } } : {}),
    },
  });
}
async function assertLessons(
  tx: Tx,
  { stageId, ids }: { stageId: string; ids: string[] },
): Promise<void> {
  if (ids.length === 0) return;
  if ((await tx.bookLesson.count({ where: { stageId, id: { in: ids } } })) !== new Set(ids).size)
    throw badRequest("Escolha uma lição deste livro.");
}
type HourActivity = Prisma.ProgramActivityGetPayload<true>;
type ActivitySlot = { unitId: string; position: number; current: HourActivity | undefined };

function validateActivityReferences(input: ActivityCommand): void {
  const { pageStart, pageEnd, kind, lessons } = input;
  if (pageEnd !== null && (pageStart === null || pageEnd < pageStart))
    throw badRequest("A página final precisa ser igual ou posterior à inicial.");
  if ((kind === "LESSON") !== lessons.length > 0)
    throw badRequest("Associe as lições do livro ao conteúdo de lição.");
  const paths = lessons.map((link) => [
    link.id,
    link.part,
    link.partId,
    link.pageId,
    link.pageActivityId,
  ]);
  if (new Set(paths.map((path) => JSON.stringify(path))).size !== lessons.length)
    throw badRequest("Referência de lição repetida.");
}

async function assertBookReferences(tx: Tx, { stageId, lessons }: ActivityCommand): Promise<void> {
  if (lessons.length === 0) return;
  const book = await tx.bookLesson.findMany({
    where: { stageId, id: { in: lessons.map((link) => link.id) } },
    select: bookLessonSelect,
  });
  for (const link of lessons) {
    const lesson = book.find((entry) => entry.id === link.id);
    if (!lesson) throw badRequest("Escolha uma lição deste livro.");
    validateBookPath(lesson, link);
  }
}

type CatalogLesson = Prisma.BookLessonGetPayload<{ select: typeof bookLessonSelect }>;

function validateBookPath(lesson: CatalogLesson, link: ActivityCommand["lessons"][number]): void {
  const page = referencedPages(lesson, link).find((entry) => entry.id === link.pageId);
  if (link.pageId && !page) throw badRequest("Escolha uma página desta parte.");
  if (link.pageActivityId && !page?.activities.some((entry) => entry.id === link.pageActivityId))
    throw badRequest("Escolha uma atividade desta página.");
}

function referencedPages(
  lesson: CatalogLesson,
  link: ActivityCommand["lessons"][number],
): CatalogLesson["pages"] {
  if (!link.partId) return lesson.pages;
  const part = lesson.parts.find((entry) => entry.id === link.partId);
  if (!part || link.part) throw badRequest("Escolha uma parte desta lição.");
  return part.pages;
}

function activitySlot(rows: HourActivity[], input: ActivityCommand): ActivitySlot {
  const first = rows[0];
  const last = rows.at(-1)!;
  if (!first) throw notFound("Hora-aula indisponível.");
  const current = rows.find((row) => row.id === input.activityId);
  if (input.activityId && !current) throw badRequest("Atividade indisponível nesta hora-aula.");
  if (!current && input.position > rows.length)
    throw badRequest("Escolha uma posição nesta hora-aula.");
  const position = current?.sequence ?? rows[input.position]?.sequence ?? last.sequence + 1;
  return { unitId: first.unitId, current, position };
}

function durationChanges(
  rows: HourActivity[],
  input: Pick<ActivityCommand, "activityId" | "others" | "durationMinutes">,
): { id: string; minutes: number }[] {
  const siblings = rows.filter((row) => row.id !== input.activityId);
  const changes = new Map(input.others.map((row) => [row.id, row.minutes]));
  if (
    changes.size !== siblings.length ||
    input.others.length !== siblings.length ||
    siblings.some((row) => !changes.has(row.id))
  )
    throw badRequest("Confira as atividades desta hora-aula.");
  if (
    input.durationMinutes + input.others.reduce((sum, row) => sum + row.minutes, 0) !==
    TEACHING_HOUR_MINUTES
  )
    throw badRequest("Distribua exatamente 60 minutos entre as atividades.");
  return siblings.flatMap((row) => {
    const minutes = changes.get(row.id);
    return minutes !== undefined && minutes !== row.durationMinutes
      ? [{ id: row.id, minutes }]
      : [];
  });
}

async function assertClosingAssessment(
  tx: Tx,
  { slot, input }: { slot: ActivitySlot; input: ActivityCommand },
): Promise<void> {
  const unitActivities = await tx.programActivity.findMany({
    where: { unitId: slot.unitId },
    orderBy: { sequence: "asc" },
    select: { id: true, kind: true, sequence: true },
  });
  const other = unitActivities.filter((activity) => activity.id !== input.activityId);
  const after = other.findIndex((activity) => activity.sequence >= slot.position);
  const sequence = other.map((activity) => activity.kind);
  sequence.splice(after === -1 ? sequence.length : after, 0, input.kind);
  const firstExam = sequence.indexOf("ASSESSMENT");
  if (firstExam === -1 || sequence.slice(firstExam).some((kind) => kind !== "ASSESSMENT"))
    throw badRequest("A prova precisa encerrar a unidade. Insira o conteúdo antes da prova.");
}

async function writeActivity(
  tx: Tx,
  { slot, input }: { slot: ActivitySlot; input: ActivityCommand },
): Promise<string> {
  const { current, unitId, position } = slot;
  const { programId, kind, pageStart, pageEnd } = input;
  const exam =
    kind === "ASSESSMENT"
      ? await tx.programAssessment.findFirstOrThrow({ where: { unitId, programId } })
      : null;
  const data = {
    title: input.title,
    ...(input.instructions === undefined ? {} : { instructions: input.instructions || null }),
    kind,
    durationMinutes: input.durationMinutes,
    pageStart,
    pageEnd,
    assessmentId: exam?.id ?? null,
    descriptionPending: current?.descriptionPending === true && current.title === input.title,
  };
  if (current) {
    await tx.programActivity.update({ where: { id: current.id }, data });
    await tx.programActivityLesson.deleteMany({ where: { activityId: current.id } });
    return current.id;
  }

  await makeRoom(tx, { table: "ProgramActivity", programId, position });
  const added = await tx.programActivity.create({
    data: {
      ...data,
      programId,
      unitId,
      teachingHourId: input.hourId,
      sequence: position,
      sourceKey: randomUUID(),
    },
  });
  return added.id;
}

async function deleteActivity(
  tx: Tx,
  input: Extract<Command, { action: "deleteActivity" }>,
): Promise<void> {
  const hour = await tx.teachingHour.findFirst({
    where: { id: input.hourId, programId: input.programId },
    include: { activities: { where: { deletedAt: null } } },
  });
  if (!hour || hour.updatedAt.toISOString() !== input.expectedChange)
    throw badRequest("Esta hora-aula mudou. Reabra a edição.");
  const item = hour.activities.find((row) => row.id === input.activityId);
  if (!item) throw notFound("Atividade indisponível.");
  if (hour.activities.length === 1)
    throw badRequest("Adicione outra atividade antes de excluir a única atividade da hora.");
  if (
    item.kind === "ASSESSMENT" &&
    !(await tx.programActivity.count({
      where: { unitId: item.unitId, kind: "ASSESSMENT", id: { not: item.id } },
    }))
  )
    throw badRequest("A unidade precisa manter sua prova de encerramento.");
  const changes = durationChanges(hour.activities, { ...input, durationMinutes: 0 });
  for (const change of changes)
    await tx.programActivity.update({
      where: { id: change.id },
      data: { durationMinutes: change.minutes },
    });
  await tx.programActivity.update({ where: { id: item.id }, data: { deletedAt: new Date() } });
  await tx.teachingHour.update({
    where: { id: hour.id },
    data: { updatedAt: new Date(Math.max(Date.now(), hour.updatedAt.getTime() + 1)) },
  });
}
async function moveActivity(
  tx: Tx,
  input: Extract<Command, { action: "moveActivity" }>,
): Promise<void> {
  const hour = await tx.teachingHour.findFirst({
    where: { id: input.hourId, programId: input.programId },
    include: { activities: { where: { deletedAt: null }, orderBy: { sequence: "asc" } } },
  });
  if (!hour || hour.updatedAt.toISOString() !== input.expectedChange)
    throw badRequest("A hora mudou. Confira a ordem atual.");
  const rows = hour.activities;
  const from = rows.findIndex((row) => row.id === input.activityId);
  if (from === -1 || input.position >= rows.length)
    throw badRequest("Posição inválida nesta hora.");
  if (from === input.position) return;
  const ordered = [...rows];
  ordered.splice(input.position, 0, ordered.splice(from, 1)[0]!);
  assertAssessmentOrder(ordered);
  const max = await tx.programActivity.aggregate({
    where: { programId: input.programId, deletedAt: {} },
    _max: { sequence: true },
  });
  const changed = ordered.filter((row, index) => row.id !== rows[index]!.id);
  await tx.programActivity.updateMany({
    where: { id: { in: changed.map((row) => row.id) } },
    data: { sequence: { increment: (max._max.sequence ?? 0) + 1 } },
  });
  for (const [index, row] of ordered.entries())
    if (row.id !== rows[index]!.id)
      await tx.programActivity.update({
        where: { id: row.id },
        data: { sequence: rows[index]!.sequence },
      });
  await tx.teachingHour.update({
    where: { id: hour.id },
    data: { updatedAt: new Date(Math.max(Date.now(), hour.updatedAt.getTime() + 1)) },
  });
}
function assertAssessmentOrder(ordered: ReadonlyArray<{ kind: string }>): void {
  const exam = ordered.findIndex((row) => row.kind === "ASSESSMENT");
  if (exam !== -1 && ordered.slice(exam).some((row) => row.kind !== "ASSESSMENT"))
    throw badRequest("A prova precisa encerrar a unidade.");
}

async function saveActivity(tx: Tx, input: ActivityCommand): Promise<void> {
  const hour = await tx.teachingHour.findFirst({
    where: { id: input.hourId, programId: input.programId },
    include: { activities: { where: { deletedAt: null }, orderBy: { sequence: "asc" } } },
  });
  if (!hour) throw notFound("Hora-aula indisponível.");
  if (hour.updatedAt.toISOString() !== input.expectedChange)
    throw badRequest("Esta hora-aula mudou. Reabra a edição para conferir os dados.");
  if (input.resolvePages && input.pageStart !== null) {
    const book = await tx.bookLesson.findMany({
      where: { stageId: input.stageId },
      select: bookLessonSelect,
    });
    const matches = bookPageRange(book, input.pageStart, input.pageEnd ?? input.pageStart);
    const lessons = matches.flatMap(({ lessonId, page }) =>
      (page.activities.length > 0 ? page.activities.map((activity) => activity.id) : [null]).map(
        (pageActivityId) => ({
          id: lessonId,
          part: "",
          partId: null,
          pageId: page.id,
          pageActivityId,
        }),
      ),
    );
    if (input.kind !== "ASSESSMENT")
      input = { ...input, kind: lessons.length > 0 ? "LESSON" : "ACTIVITY", lessons };
  }
  validateActivityReferences(input);
  const slot = activitySlot(hour.activities, input);
  const changes = durationChanges(hour.activities, input);
  await assertBookReferences(tx, input);
  await assertClosingAssessment(tx, { slot, input });
  const activityId = await writeActivity(tx, { slot, input });
  if (input.lessons.length > 0)
    await tx.programActivityLesson.createMany({
      data: input.lessons.map(({ id: lessonId, part, partId, pageId, pageActivityId }) => ({
        activityId,
        lessonId,
        part,
        partId: partId ?? null,
        pageId: pageId ?? null,
        pageActivityId: pageActivityId ?? null,
      })),
    });
  for (const change of changes)
    await tx.programActivity.update({
      where: { id: change.id },
      data: { durationMinutes: change.minutes },
    });
  await tx.teachingHour.update({
    where: { id: hour.id },
    data: { updatedAt: new Date(Math.max(Date.now(), hour.updatedAt.getTime() + 1)) },
  });
}

async function startProgram(
  tx: Tx,
  {
    stage,
    input,
  }: { stage: { id: string; name: string }; input: Extract<Command, { action: "start" }> },
): Promise<{ id: string }> {
  if (!(await tx.bookLesson.count({ where: { stageId: stage.id } })))
    throw badRequest("Cadastre a primeira lição do livro antes de iniciar a programação.");
  const modality = await tx.teachingModality.upsert({
    where: { code: DEFAULT_TEACHING_MODALITY.code },
    update: {},
    create: DEFAULT_TEACHING_MODALITY,
  });
  if (modality.deletedAt) throw badRequest("Carga semanal indisponível.");
  const existing = await tx.teachingProgram.findFirst({
    where: {
      stageId: stage.id,
      modalityId: modality.id,
      scheduleType: input.scheduleType,
      retiredAt: null,
    },
  });
  if (existing) throw badRequest("Já existe uma programação com esse formato e carga semanal.");
  const program = await tx.teachingProgram.create({
    data: {
      stageId: stage.id,
      modalityId: modality.id,
      scheduleType: input.scheduleType,
      sourceProvider: "SCHOOL",
      sourceReference: stage.name,
      sourceRevision: "manual",
      contentHash: "manual",
    },
  });
  await addUnit(tx, { ...input, programId: program.id });
  return { id: program.id };
}
