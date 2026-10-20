import type { ClassRecordContent, ClassRecordSnapshot } from "@lazuli/validators";
import { badRequest } from "../trpc/errors.js";
import type { RecordContext, RecordSession } from "./data.js";

/** The selected step must belong to this class or this student's stage plan. */
export async function resolveRecordedSteps(
  context: RecordContext,
  session: RecordSession,
  snapshot: ClassRecordSnapshot,
  previous: ClassRecordSnapshot | null,
) {
  async function resolve(
    content: ClassRecordContent | null,
    before: ClassRecordContent | null,
    progressId?: string | null,
  ) {
    if (!content) return;
    if (!content.planItemId) {
      delete content.planItemStatus;
      delete content.planItemTitle;
      return;
    }
    if (session.class.scheduleType !== "REGULAR" && !progressId) {
      throw badRequest("Selecione o estágio do aluno antes de vincular uma etapa.");
    }
    const item = await context.database.stagePlanItem.findFirst({
      where: {
        id: content.planItemId,
        ...(content.planItemId === before?.planItemId ? {} : { deletedAt: null }),
        plan:
          session.class.scheduleType === "REGULAR"
            ? { classId: session.classId }
            : {
                progressRecords: {
                  some: { id: progressId ?? "", enrollment: { classId: session.classId } },
                },
              },
      },
      select: { title: true },
    });
    if (!item) throw badRequest("A etapa selecionada não pertence ao planejamento desta aula.");
    content.planItemTitle = item.title;
    content.planItemStatus ??= "PARTIAL";
  }
  await resolve(snapshot.sharedContent, previous?.sharedContent ?? null);
  for (const entry of snapshot.entries) {
    await resolve(
      entry.content,
      previous?.entries.find((row) => row.enrollmentId === entry.enrollmentId)?.content ?? null,
      entry.progressId,
    );
  }
}
