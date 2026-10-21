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
