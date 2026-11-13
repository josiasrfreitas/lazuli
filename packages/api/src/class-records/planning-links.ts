import { recordedActivities } from "@lazuli/domain";
import { readActivityLabels } from "../teaching-programs/labels.js";
import type { Prisma } from "@lazuli/db";
import type { ClassRecordContent, ClassRecordSnapshot } from "@lazuli/validators";
import { badRequest } from "../trpc/errors.js";
import type { RecordContext, RecordSession } from "./data.js";

type LinkInput = {
  content: ClassRecordContent;
  before: ClassRecordContent | null;
  progressId: string | null;
  session: RecordSession;
};
/** A step belongs to the shared plan or this student's stage attempt. */
export async function resolveRecordedSteps(
  context: RecordContext,
  input: {
    session: RecordSession;
    snapshot: ClassRecordSnapshot;
    previous: ClassRecordSnapshot | null;
  },
): Promise<void> {
  const { session, snapshot, previous } = input;
  if (snapshot.sharedContent)
    await resolve(context, {
      session,
      content: snapshot.sharedContent,
      before: previous?.sharedContent ?? null,
      progressId: null,
    });
  for (const entry of snapshot.entries) {
    if (entry.content)
      await resolve(context, {
        session,
        content: entry.content,
        before:
          previous?.entries.find((row) => row.enrollmentId === entry.enrollmentId)?.content ?? null,
        progressId: entry.progressId,
      });
  }
}
async function resolve(context: RecordContext, input: LinkInput): Promise<void> {
  const { content, before, progressId, session } = input;
  if (content.planItems !== undefined) {
    await resolveCoverage(context, input);
    return;
  }
  if (!content.planItemId) {
    delete content.planItemStatus;
    delete content.planItemTitle;
    return;
  }
  const regular = session.class.scheduleType === "REGULAR";
  if (!regular && !progressId)
    throw badRequest("Selecione o estágio do aluno antes de vincular uma etapa.");
  const unchanged = content.planItemId === before?.planItemId;
  const plan = stepPlanScope(session, progressId);
  const item = await context.database.stagePlanItem.findFirst({
    where: {
      id: content.planItemId,
      // An explicit filter lets an unchanged retired link survive the default soft-delete scope.
      deletedAt: unchanged ? {} : null,
      plan,
    },
    select: { title: true },
  });
  if (!item) throw badRequest("A etapa selecionada não pertence ao planejamento desta aula.");
  content.planItemTitle = unchanged ? (before.planItemTitle ?? item.title) : item.title;
  content.planItemStatus ??= "PARTIAL";
}

function stepPlanScope(
  session: RecordSession,
  progressId: string | null,
): Prisma.StagePlanWhereInput {
  return session.class.scheduleType === "REGULAR"
    ? { classId: session.classId }
    : {
        progressRecords: {
          some: { id: progressId ?? "", enrollment: { classId: session.classId } },
        },
      };
}

async function resolveCoverage(
  context: RecordContext,
  { content, before, progressId, session }: LinkInput,
): Promise<void> {
  const coverage = content.planItems ?? [];
  if (session.class.scheduleType !== "REGULAR" && !progressId && coverage.length)
    throw badRequest("Selecione o estágio do aluno antes de vincular atividades.");
  const previous = new Map(before ? recordedActivities(before).map((item) => [item.id, item]) : []);
  const items = coverage.length
    ? await context.database.stagePlanItem.findMany({
        where: {
          id: { in: coverage.map((item) => item.id) },
          deletedAt: {},
          plan: stepPlanScope(session, progressId),
        },
        orderBy: [
          { plannedOn: "asc" },
          { programActivity: { sequence: "asc" } },
          { createdAt: "asc" },
        ],
        select: { id: true, title: true, programActivityId: true, deletedAt: true },
      })
    : [];
  if (
    items.length !== coverage.length ||
    items.some((item) => item.deletedAt && !previous.has(item.id))
  )
    throw badRequest("Uma das atividades não pertence ao planejamento desta aula.");
  const labels = await readActivityLabels(
    context.database,
    items.flatMap((item) => (item.programActivityId ? [item.programActivityId] : [])),
  );
  content.planItems = items.map((item) => ({
    id: item.id,
    status: coverage.find((entry) => entry.id === item.id)?.status ?? "PARTIAL",
    title:
      previous.get(item.id)?.title ??
      (item.programActivityId ? labels.get(item.programActivityId) : null) ??
      item.title,
  }));
  const last = content.planItems.at(-1);
  content.planItemId = last?.id ?? null;
  if (last) {
    content.planItemStatus = last.status;
    content.planItemTitle = last.title;
  } else {
    delete content.planItemStatus;
    delete content.planItemTitle;
  }
}
