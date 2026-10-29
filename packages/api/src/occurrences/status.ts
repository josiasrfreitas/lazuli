import { TRPCError } from "@trpc/server";
import type { OccurrenceStatusChange } from "@lazuli/validators";
import { loadOccurrence, invalid, type FollowUpContext } from "./data.js";

export async function changeOccurrenceStatus(
  context: FollowUpContext,
  input: OccurrenceStatusChange,
): Promise<void> {
  if (context.staffUser.role === "TEACHER") throw new TRPCError({ code: "FORBIDDEN" });
  const row = await loadOccurrence(context, input.id);
  const allowed =
    row.status === "OPEN"
      ? ["FOLLOWING_UP", "CLOSED"]
      : row.status === "FOLLOWING_UP"
        ? ["CLOSED"]
        : ["FOLLOWING_UP"];
  if (!allowed.includes(input.status)) invalid("Esta mudança de estado não está disponível.");
  const changed = await context.database.pedagogicalOccurrence.updateMany({
    where: {
      id: row.id,
      deletedAt: null,
      statusVersion: input.expectedVersion,
      status: row.status,
    },
    data: { status: input.status, statusVersion: { increment: 1 } },
  });
  if (!changed.count)
    throw new TRPCError({
      code: "CONFLICT",
      message: "A ocorrência mudou. Atualize o registro antes de tentar novamente.",
    });
  await context.database.occurrenceStatusChange.create({
    data: {
      occurrenceId: row.id,
      authorId: context.staffUser.id,
      createdAt: context.now,
      fromStatus: row.status,
      toStatus: input.status,
      conclusion: input.status === "CLOSED" ? input.conclusion : null,
    },
  });
}
