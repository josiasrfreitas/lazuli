import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { db } from "@lazuli/db";
import { createCaller } from "@lazuli/api";
import { readActivityContexts } from "../../src/teaching-programs/labels.js";
import {
  ADMIN,
  caller,
  contextWithQueue,
  ensureTeacherUser,
  seedClassCatalogFixtures,
  cleanClassDatabase,
  TEACHER_USER_ID,
} from "../support/class-test-support.js";
import { recordingSessionsGenerateQueue } from "../support/session-generation-queue-support.js";

const admin = caller();
const catalog = admin.teachingPrograms;
let stageId: string,
  semesterId: string,
  nextStageId: string,
  trackId: string,
  productLineId: string;
let planId: string | undefined;
before(async () => {
  await cleanClassDatabase();
  await ensureTeacherUser();
  ({ stageId, semesterId, nextStageId } = await seedClassCatalogFixtures());
  const stage = await db.stage.findUniqueOrThrow({
    where: { id: stageId },
    include: { track: true },
  });
  trackId = stage.trackId;
  productLineId = stage.track.productLineId;
});
after(async () => {
  if (planId) {
    await db.stagePlanItem.deleteMany({ where: { planId } });
    await db.stagePlan.delete({ where: { id: planId } });
  }
  const stages = { in: [stageId, nextStageId] };
  const programs = await db.teachingProgram.findMany({
    where: { stageId: stages },
    select: { id: true },
  });
  const programId = { in: programs.map((program) => program.id) };
  await db.programActivityLesson.deleteMany({ where: { activity: { programId } } });
  await db.programActivity.deleteMany({ where: { programId } });
  await db.teachingHour.deleteMany({ where: { programId } });
  await db.programAssessment.deleteMany({ where: { programId } });
  await db.programUnit.deleteMany({ where: { programId } });
  await db.teachingProgram.deleteMany({ where: { stageId: stages } });
  const part = { lesson: { stageId: stages } };
  await db.bookPageActivity.deleteMany({ where: { page: { lesson: { stageId: stages } } } });
  await db.bookLessonPage.deleteMany({ where: { lesson: { stageId: stages } } });
  await db.bookLessonPart.deleteMany({ where: part });
  await db.bookLesson.deleteMany({ where: { stageId: stages } });
  await cleanClassDatabase();
  await db.$disconnect();
});
void it("opens empty tracks, protects duplicate codes and serializes two moves of the same neighbor", async () => {
  const { id: other } = await catalog.editCatalog({
    action: "createTrack",
    name: "GRE-29 Class Editor",
    ageGroup: "ADULT",
    productLineId,
  });
  const directory = await catalog.directory();
  assert.deepEqual(directory.tracks.find((track) => track.id === other)?.stages, []);
  const params = {
    action: "createStage",
    trackId: other,
    internalCode: "GRE29E",
    name: "Entrada",
  } as const;
  const newStage = await catalog.editCatalog(params);
  await catalog.editCatalog({
    action: "editStage",
    id: newStage.id,
    internalCode: "GRE29X",
    name: "Entrada corrigida",
  });
  const stageDetails = await catalog.detail({ id: newStage.id });
  assert.equal(stageDetails?.name, "Entrada corrigida");
  await assert.rejects(catalog.editCatalog({ ...params, internalCode: "GRE29X" }), /código/);
  const order = await catalog.directory();
  const prior = order.tracks[order.tracks.findIndex((track) => track.id === other) - 1]!;
  await catalog.editCatalog({
    action: "move",
    target: "track",
    id: other,
    neighborId: prior.id,
    direction: "up",
    showLegacy: true,
  });
  const reordered = await catalog.directory();
  const moved = reordered.tracks.map((track) => track.id);
  assert.equal(moved.indexOf(other) + 1, moved.indexOf(prior.id));
  const move = {
    action: "move",
    target: "stage",
    id: nextStageId,
    neighborId: stageId,
    direction: "up",
    showLegacy: false,
  } as const;
  const operations = await Promise.allSettled([
    catalog.editCatalog(move),
    catalog.editCatalog(move),
  ]);
  assert.equal(operations.filter((option) => option.status === "fulfilled").length, 1);
  const afterConcurrentMoves = await catalog.directory();
  assert.deepEqual(
    afterConcurrentMoves.tracks
      .find((track) => track.id === trackId)
      ?.stages.map((stage) => [stage.id, stage.sequence]),
    [
      [nextStageId, 1],
      [stageId, 2],
    ],
  );
  const teacher = createCaller({ db, staffUser: { ...ADMIN, role: "TEACHER" } });
  await assert.rejects(
    teacher.teachingPrograms.editCatalog(params),
    (event) => event instanceof Error && "code" in event && event.code === "FORBIDDEN",
  );
});
void it("links whole and partial book passages in either program and rejects a mismatched hierarchy atomically", async () => {
  const bookStage = { stageId: nextStageId };
  const foreign = await catalog.editCatalog({ action: "lesson", stageId, title: "Outro livro" });
  const lesson = await catalog.editCatalog({ action: "lesson", ...bookStage, title: "Lição 3" });
  const parent = { ...bookStage, lessonId: lesson.id };
  const a = await catalog.editCatalog({ action: "part", ...parent, title: "Parte A" });
  const b = await catalog.editCatalog({ action: "part", ...parent, title: "Parte B" });
  await assert.rejects(
    catalog.editCatalog({ action: "part", ...parent, title: "parte a" }),
    /já tem uma parte/,
  );
  await assert.rejects(
    catalog.editCatalog({ action: "page", ...parent, stageId, partId: a.id, number: 18 }),
    /lição deste livro/,
  );
  const page = await catalog.editCatalog({ action: "page", ...parent, partId: a.id, number: 18 });
  await catalog.editCatalog({ action: "page", ...parent, partId: a.id, number: 19 });
  const otherPage = await catalog.editCatalog({
    action: "page",
    ...parent,
    partId: b.id,
    number: 18,
  });
  await assert.rejects(
    catalog.editCatalog({ action: "page", ...parent, partId: a.id, number: 18 }),
    /já existe/,
  );
  const onPage = { ...parent, partId: a.id, pageId: page.id };
  const one = await catalog.editCatalog({
    action: "pageActivity",
    ...onPage,
    title: "Exercício 1",
  });
  const two = await catalog.editCatalog({
    action: "pageActivity",
    ...onPage,
    title: "Exercício 2",
  });
  await assert.rejects(
    catalog.editCatalog({ action: "pageActivity", ...onPage, partId: b.id, title: "Incompatível" }),
    /página desta parte/,
  );
  for (const scheduleType of ["REGULAR", "PERSONALIZED"] as const) {
    const program = await catalog.editProgram({
      action: "start",
      ...bookStage,
      scheduleType,
      unitTitle: "Unidade 1",
      assessmentTitle: "Prova",
    });
    const unit = (await catalog.detail({ id: nextStageId }))!.programs.find(
      (p) => p.id === program.id,
    )!.units[0]!;
    await catalog.editProgram({
      action: "hour",
      ...parent,
      programId: program.id,
      unitId: unit.id,
      title: "Leitura",
    });
  }
  const read = () => catalog.detail({ id: nextStageId });
  const book = await read();
  assert.deepEqual(
    book?.lessons[0]?.parts.map((item) => [
      item.title,
      item.pages.map((row) => [row.number, row.activities.map((activity) => activity.title)]),
    ]),
    [
      [
        "Parte A",
        [
          [18, ["Exercício 1", "Exercício 2"]],
          [19, []],
        ],
      ],
      ["Parte B", [[18, []]]],
    ],
  );
  const base = { id: lesson.id, part: "" };
  const full = { ...base, partId: a.id, pageId: page.id, pageActivityId: two.id };
  for (const program of book!.programs) {
    const hour = program.units[0]!.teachingHours[0]!;
    const insert = {
      action: "activity" as const,
      ...bookStage,
      programId: program.id,
      hourId: hour.id,
      activityId: null,
      position: 0,
      expectedChange: hour.lastChange,
      kind: "LESSON" as const,
      title: "Prática",
      durationMinutes: 15,
      pageStart: null,
      pageEnd: null,
      others: [{ id: hour.activities[0]!.id, minutes: 45 }],
    };
    for (const [reference, reason] of [
      [{ ...full, id: foreign.id }, /lição deste livro/],
      [{ ...full, partId: b.id }, /página desta parte/],
      [{ ...full, partId: b.id, pageId: otherPage.id }, /atividade desta página/],
      [{ ...base, pageId: foreign.id }, /página/],
    ] as const)
      await assert.rejects(catalog.editProgram({ ...insert, lessons: [reference] }), reason);
    await assert.rejects(catalog.editProgram({ ...insert, lessons: [full, full] }), /repetida/);
    const untouched = (await read())!.programs.find((p) => p.id === program.id)!.units[0]!
      .teachingHours[0]!;
    assert.deepEqual(
      [
        untouched.lastChange,
        untouched.activities.map((item) => [item.bookTitle, item.durationMinutes]),
      ],
      [hour.lastChange, [["Leitura", 60]]],
    );
    await catalog.editProgram({
      ...insert,
      lessons: [
        base,
        { ...base, partId: b.id },
        { ...base, partId: a.id, pageId: page.id },
        { ...full, pageActivityId: one.id },
        full,
        { ...base, part: "Parte livre" },
      ],
    });
    await assert.rejects(catalog.editProgram({ ...insert, lessons: [full] }), /mudou/);
  }
  await catalog.editCatalog({
    action: "pageActivity",
    ...onPage,
    pageActivityId: two.id,
    title: "Diálogo",
  });
  await catalog.editCatalog({
    action: "page",
    ...parent,
    partId: a.id,
    pageId: page.id,
    number: 20,
  });
  const updated = await read();
  assert.deepEqual(updated!.programs.map((p) => p.scheduleType).sort(), [
    "PERSONALIZED",
    "REGULAR",
  ]);
  for (const program of updated!.programs) {
    const activities = program.units[0]!.teachingHours[0]!.activities;
    assert.deepEqual(
      activities.map((item) => [item.bookTitle, item.durationMinutes]),
      [
        ["Prática", 15],
        ["Leitura", 45],
      ],
    );
    const references = activities[0]!.lessons
      .map((row) =>
        [row.title, row.bookPart?.title ?? row.part, row.bookPage?.number, row.pageActivity?.title]
          .filter(Boolean)
          .join(" / "),
      )
      .sort();
    assert.deepEqual(references, [
      "Lição 3",
      "Lição 3 / Parte A / 20",
      "Lição 3 / Parte A / 20 / Diálogo",
      "Lição 3 / Parte A / 20 / Exercício 1",
      "Lição 3 / Parte B",
      "Lição 3 / Parte livre",
    ]);
    const context = await readActivityContexts(db, [activities[0]!.id]);
    assert.deepEqual(
      context
        .get(activities[0]!.id)
        ?.lessons.map((row) => row.part)
        .sort(),
      ["", "Parte A", "Parte B", "Parte livre"],
    );
  }
});

void it("writes lesson references, pages and a full 60-minute distribution atomically and preserves historical plan items", async () => {
  const lesson = await catalog.editCatalog({ action: "lesson", stageId, title: "Greetings" });
  const program = await catalog.editProgram({
    action: "start",
    stageId,
    scheduleType: "REGULAR",
    unitTitle: "Unidade 1",
    assessmentTitle: "Prova escrita",
  });
  type Program = NonNullable<Awaited<ReturnType<typeof catalog.detail>>>["programs"][number];
  const load = async (): Promise<Program> => {
    const stage = await catalog.detail({ id: stageId });
    const record = stage?.programs.find((candidate) => candidate.id === program.id);
    assert.ok(record);
    return record;
  };
  const currentProgram = await load();
  const unitId = currentProgram.units[0]!.id;
  const common = { stageId, programId: program.id, unitId };
  await catalog.editProgram({ action: "hour", ...common, lessonId: lesson.id, title: "Leitura" });
  await catalog.editCatalog({
    action: "lesson",
    stageId,
    lessonId: lesson.id,
    title: "Greetings and introductions",
  });
  const withLesson = await load();
  let hour = withLesson.units[0]!.teachingHours[0]!;
  const first = hour.activities[0]!;
  assert.equal(first.lessons[0]?.title, "Greetings and introductions");
  const add = {
    action: "activity",
    stageId,
    programId: program.id,
    hourId: hour.id,
    activityId: null,
    position: 1,
    title: "Escuta",
    kind: "ACTIVITY",
    lessons: [],
    durationMinutes: 30,
    pageStart: 22,
    pageEnd: null,
    expectedChange: hour.lastChange,
    others: [{ id: first.id, minutes: 30 }],
  } as const;
  await catalog.editProgram({ ...add, lessons: [], others: [...add.others] });
  const withTwoActivities = await load();
  hour = withTwoActivities.units[0]!.teachingHours[0]!;
  const last = hour.activities[1]!;
  const insert = {
    ...add,
    title: "Leitura em dupla",
    kind: "LESSON" as const,
    lessons: [{ id: lesson.id, part: "A" }],
    pageStart: 18,
    pageEnd: 21,
    durationMinutes: 10,
    expectedChange: hour.lastChange,
    others: [
      { id: first.id, minutes: 20 },
      { id: last.id, minutes: 30 },
    ],
  };
  await assert.rejects(catalog.editProgram({ ...insert, durationMinutes: 9 }), /60 minutos/);
  const afterRejectedInsert = await load();
  assert.deepEqual(
    afterRejectedInsert.units[0]!.teachingHours[0]!.activities.map(
      (activity) => activity.durationMinutes,
    ),
    [30, 30],
  );
  await catalog.editProgram(insert);
  await assert.rejects(catalog.editProgram(insert), /mudou/);
  const withThreeActivities = await load();
  hour = withThreeActivities.units[0]!.teachingHours[0]!;
  assert.deepEqual(
    hour.activities.map((activity) => [
      activity.bookTitle,
      activity.durationMinutes,
      activity.pageStart,
      activity.pageEnd,
    ]),
    [
      ["Leitura", 20, null, null],
      ["Leitura em dupla", 10, 18, 21],
      ["Escuta", 30, 22, null],
    ],
  );
  const saved = hour.activities[1]!;
  const page = await catalog.editCatalog({
    action: "page",
    stageId,
    lessonId: lesson.id,
    number: 22,
  });
  for (let attempt = 0; attempt < 2; attempt++)
    await catalog.editCatalog({ action: "pages", stageId, lessonId: lesson.id, start: 1, end: 15 });
  assert.equal(
    await db.bookLessonPage.count({ where: { lessonId: lesson.id, number: { gte: 1, lte: 15 } } }),
    15,
  );
  await assert.rejects(
    catalog.editCatalog({ action: "pages", stageId, lessonId: lesson.id, start: 15, end: 1 }),
    /final/,
  );
  const exercise = await catalog.editCatalog({
    action: "pageActivity",
    stageId,
    lessonId: lesson.id,
    pageId: page.id,
    title: "Exercício oral",
  });
  await catalog.editProgram({
    ...add,
    activityId: last.id,
    position: 2,
    resolvePages: true,
    lessons: [],
    expectedChange: hour.lastChange,
    others: [
      { id: first.id, minutes: 20 },
      { id: saved.id, minutes: 10 },
    ],
  });
  hour = (await load()).units[0]!.teachingHours[0]!;
  assert.equal(hour.activities[2]!.lessons[0]?.pageActivity?.id, exercise.id);
  const move = {
    action: "moveActivity" as const,
    stageId,
    programId: program.id,
    hourId: hour.id,
    activityId: last.id,
    expectedChange: hour.lastChange,
    position: 0,
  };
  await catalog.editProgram(move);
  await assert.rejects(catalog.editProgram(move), /mudou/);
  hour = (await load()).units[0]!.teachingHours[0]!;
  assert.deepEqual(
    hour.activities.map((row) => [row.id, row.durationMinutes]),
    [
      [last.id, 30],
      [first.id, 20],
      [saved.id, 10],
    ],
  );
  const classes = createCaller(
    contextWithQueue({ queue: recordingSessionsGenerateQueue("catalog-editor") }),
  ).classes;
  const classInput = {
    teacherId: TEACHER_USER_ID,
    scheduleType: "REGULAR" as const,
    format: "IN_PERSON" as const,
    sharedStageId: stageId,
    semesterId,
    startDate: "2026-03-01",
    slots: [{ weekday: "TUESDAY" as const, startTime: "14:00", endTime: "16:00" }],
  };
  const group = await classes.create(classInput);
  const date = new Date("2026-03-03");
  const plan = await db.stagePlan.create({
    data: {
      classId: group.id,
      stageId,
      createdById: ADMIN.id,
      plannedStartOn: date,
      plannedEndOn: date,
      items: {
        create: {
          programActivityId: saved.id,
          title: saved.bookTitle,
          kind: "CONTENT",
          plannedOn: date,
          pageFrom: 18,
          pageTo: 21,
        },
      },
    },
  });
  planId = plan.id;
  await catalog.editProgram({
    ...insert,
    activityId: saved.id,
    title: "Leitura revisada",
    pageStart: 24,
    pageEnd: null,
    expectedChange: hour.lastChange,
  });
  const savedPlan = await admin.planning.detail({ classId: group.id });
  assert.equal(savedPlan.plan?.items[0]?.title, "Leitura em dupla");
  assert.deepEqual(
    await db.stagePlanItem.findFirstOrThrow({
      where: { planId },
      select: { programActivityId: true, pageFrom: true, pageTo: true },
    }),
    { programActivityId: saved.id, pageFrom: 18, pageTo: 21 },
  );
  await catalog.editProgram({
    action: "unit",
    ...common,
    unitTitle: "Unidade 2",
    assessmentTitle: "Prova oral",
  });
  await catalog.editProgram({
    action: "hour",
    ...common,
    lessonId: null,
    title: "Continuação da prova escrita",
  });
  const withExamContinuation = await load();
  const units = withExamContinuation.units;
  assert.deepEqual(
    units.map((unit) => unit.teachingHours.map((teachingHour) => teachingHour.sequence)),
    [[1, 2, 3], [4]],
  );
  assert.equal(
    units[0]!.teachingHours[1]!.activities[0]!.assessment?.id,
    units[0]!.teachingHours[2]!.activities[0]!.assessment?.id,
  );

  assert.equal(withExamContinuation.assessmentCount, 2);
  await catalog.editCatalog({ action: "legacy", target: "stage", id: stageId });
  const classOptions = await classes.formOptions();
  const available = new Set(classOptions.stages.map((stage) => stage.id));
  assert.equal(available.has(stageId), false);
  assert.equal(available.has(nextStageId), true);
  await assert.rejects(
    classes.create({
      ...classInput,
      slots: [{ weekday: "FRIDAY", startTime: "09:00", endTime: "10:00" }],
    }),
    /Legacy/,
  );
  await catalog.editCatalog({ action: "legacy", target: "track", id: trackId });
  const legacyTrackOptions = await classes.formOptions();
  assert.equal(
    legacyTrackOptions.stages.some((stage) => stage.id === nextStageId),
    false,
  );
  const classDetails = await classes.byId({ id: group.id });
  assert.equal(classDetails.books.current?.id, stageId);
  const legacyStage = await catalog.detail({ id: stageId });
  assert.equal(legacyStage?.programs[0]?.units.length, 2);
});
