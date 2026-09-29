import type { DatabaseClient } from "@lazuli/db";
import { TRPCError } from "@trpc/server";

type CommandDatabase = Pick<DatabaseClient, "student" | "contract">;

/** Call inside the creation transaction; both entry points serialize the same identity. */
export async function lockCreationCommand(
  database: Pick<DatabaseClient, "$queryRaw">,
  commandId: string,
): Promise<void> {
  await database.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${commandId.toLowerCase()}, 0)) IS NULL AS locked
  `;
}

/** Student metadata owns wizard commands, including those that also created a contract. */
export async function assertCreationCommandOwner(
  database: CommandDatabase,
  command: { id: string; owner: "studentCompletion" | "contract" },
): Promise<void> {
  const { id: commandId, owner } = command;
  const student = await database.student.findUnique({
    where: { commandId },
    select: { id: true },
  });
  if (student && owner === "studentCompletion") return;
  const contract =
    owner === "studentCompletion"
      ? await database.contract.findUnique({ where: { commandId }, select: { id: true } })
      : null;
  if (student || contract) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Identidade de criação usada em outra operação.",
    });
  }
}
