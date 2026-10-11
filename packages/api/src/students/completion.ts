import { createHash } from "node:crypto";
import type { TransactionClient } from "@lazuli/db";
import type { StudentCompletionInput } from "@lazuli/validators";
import { TRPCError } from "@trpc/server";
import { finance } from "../finance/index.js";
import type { Context, StaffUser } from "../trpc/context.js";
import { activityTransaction, recordActivity } from "../activity/record.js";
import { studentSubject } from "../activity/subjects.js";
import { createStudent } from "./data.js";
import { assertCreationCommandOwner, lockCreationCommand } from "../creation-command.js";

type Command = { id: string; fingerprint: string };
type CompletedStudent = { id: string };

function commandFor(values: StudentCompletionInput): Command {
  return {
    id: "contract" in values ? values.contract.commandId : values.commandId,
    fingerprint: createHash("sha256").update(JSON.stringify(values)).digest("hex"),
  };
}

async function findCompletion(
  database: Pick<Context["db"], "student" | "contract">,
  command: Command,
): Promise<CompletedStudent | null> {
  await assertCreationCommandOwner(database, { id: command.id, owner: "studentCompletion" });
  const student = await database.student.findUnique({
    where: { commandId: command.id },
    select: { id: true, commandFingerprint: true },
  });
  if (!student) return null;
  if (student.commandFingerprint !== command.fingerprint) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Identidade de criação usada com dados diferentes.",
    });
  }
  return { id: student.id };
}

export async function persistStudentCompletion(input: {
  database: TransactionClient;
  values: StudentCompletionInput;
  staffUserId: string;
}): Promise<CompletedStudent> {
  const command = commandFor(input.values);
  await lockCreationCommand(input.database, command.id);
  const previous = await findCompletion(input.database, command);
  if (previous) return previous;
  let student: CompletedStudent;
  if ("contract" in input.values) {
    const contract = await finance(input.database, input.staffUserId).createMonthlyContract(
      input.values.contract,
    );
    student = contract.student;
  } else {
    student = await createStudent({ database: input.database, values: input.values.student });
  }
  return input.database.student.update({
    where: { id: student.id },
    data: { commandId: command.id, commandFingerprint: command.fingerprint },
    select: { id: true },
  });
}

export async function completeStudent(input: {
  database: Context["db"];
  values: StudentCompletionInput;
  staffUser: StaffUser;
  now?: Date;
}): Promise<CompletedStudent> {
  try {
    return await activityTransaction(
      { ...input, db: input.database },
      "students.completeCreation",
      async (database) => {
        const student = await persistStudentCompletion({
          database,
          values: input.values,
          staffUserId: input.staffUser.id,
        });
        if ("contract" in input.values) {
          const contract = await database.contract.findUniqueOrThrow({
            where: { commandId: input.values.contract.commandId },
            select: { id: true },
          });
          const subject = await studentSubject(database, student.id);
          await recordActivity(database, input, "finance.createMonthlyContract", {
            subject: { ...subject, type: "contract", id: contract.id },
            deduplicationKey: `finance.contract:${contract.id}`,
          });
        }
        return student;
      },
      async (student, database) => ({
        subject: await studentSubject(database, student.id),
        deduplicationKey: `students.completeCreation:${student.id}`,
      }),
    );
  } catch (error) {
    // The losing concurrent transaction rolls back; recover only the same committed command.
    const previous = await findCompletion(input.database, commandFor(input.values));
    if (previous) return previous;
    throw error;
  }
}
