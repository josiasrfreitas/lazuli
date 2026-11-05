import { z } from "zod";
import { createMonthlyContractInputSchema } from "./contracts.js";
import { civilDateSchema } from "./civil-date.js";
import { classFormatSchema, classScheduleTypeSchema } from "./class.js";
import { studentCreateInputSchema, studentUpdateContactInputSchema } from "./student.js";
import { leadRegistrationSchema } from "./leads.js";

const MILLISECONDS_PER_DAY = 86_400_000;
const MAX_CALENDAR_DAYS = 7;
const entryPeriodSchema = z.enum(["CURRENT", "NEXT"]);

export const studentIntakeOptionsSchema = z
  .object({
    stageId: z.string().uuid().nullable(),
    entryPeriod: entryPeriodSchema.default("CURRENT"),
    scheduleType: classScheduleTypeSchema,
    format: classFormatSchema,
    from: civilDateSchema,
    through: civilDateSchema,
  })
  .strict()
  .refine(
    (value) => {
      const days =
        (new Date(value.through).getTime() - new Date(value.from).getTime()) / MILLISECONDS_PER_DAY;
      return days >= 0 && days <= MAX_CALENDAR_DAYS;
    },
    { path: ["through"], message: "Consulte até uma semana por vez." },
  );

export const studentIntakeEnrollSchema = z
  .object({
    documentSessionId: z.string().uuid().optional(),
    commandId: z.string().uuid(),
    candidateId: z.string().uuid().nullable(),
    leadRegistration: leadRegistrationSchema.nullable().default(null),
    student: studentCreateInputSchema,
    classId: z.string().uuid().nullable(),
    planId: z.string().uuid().nullable().default(null),
    stageId: z.string().uuid().nullable(),
    entryPeriod: entryPeriodSchema.default("CURRENT"),
    contract: createMonthlyContractInputSchema.nullable().default(null),
    allowPending: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.candidateId && value.leadRegistration)
      context.addIssue({
        code: "custom",
        path: ["leadRegistration"],
        message: "Escolha um lead existente ou um novo rascunho.",
      });
    if (value.entryPeriod === "NEXT" && value.classId)
      context.addIssue({
        code: "custom",
        path: ["classId"],
        message: "A turma de entrada pertence ao período atual.",
      });
    if (value.entryPeriod === "CURRENT" && value.planId)
      context.addIssue({
        code: "custom",
        path: ["planId"],
        message: "A turma planejada pertence ao próximo período.",
      });
    if (!value.contract && !value.allowPending)
      context.addIssue({
        code: "custom",
        path: ["allowPending"],
        message: "Confirme o cadastro com pendências.",
      });
    if (value.contract && invalidNewStudentContract(value.contract, value.commandId))
      context.addIssue({
        code: "custom",
        path: ["contract"],
        message: "O contrato deve pertencer ao novo aluno.",
      });
  });

export const studentIntakeAllocateSchema = z
  .object({
    studentId: z.string().uuid(),
    classId: z.string().uuid(),
    stageId: z.string().uuid(),
  })
  .strict();

export const studentIntakeResumeSchema = z
  .object({
    documentSessionId: z.string().uuid().optional(),
    studentId: z.string().uuid(),
    contact: studentUpdateContactInputSchema,
    classId: z.string().uuid().nullable(),
    planId: z.string().uuid().nullable().default(null),
    stageId: z.string().uuid().nullable(),
    entryPeriod: entryPeriodSchema.default("CURRENT"),
    contract: createMonthlyContractInputSchema.nullable(),
    allowPending: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.contract &&
      (value.contract.studentId !== value.studentId ||
        value.contract.newStudent ||
        value.contract.renewedFromId)
    )
      context.addIssue({
        code: "custom",
        path: ["contract"],
        message: "O contrato deve pertencer a este aluno.",
      });
  });

function invalidNewStudentContract(
  contract: z.infer<typeof createMonthlyContractInputSchema>,
  commandId: string,
): boolean {
  return (
    !contract.newStudent ||
    Boolean(contract.studentId) ||
    Boolean(contract.renewedFromId) ||
    contract.commandId === commandId
  );
}
