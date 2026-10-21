import { z } from "zod";
import { createMonthlyContractInputSchema } from "./contracts.js";
import { civilDateSchema } from "./civil-date.js";
import { classFormatSchema, classScheduleTypeSchema } from "./class.js";
import { studentCreateInputSchema, studentUpdateContactInputSchema } from "./student.js";

export const studentIntakeOptionsSchema = z
  .object({
    stageId: z.string().uuid().nullable(),
    scheduleType: classScheduleTypeSchema,
    format: classFormatSchema,
    from: civilDateSchema,
    through: civilDateSchema,
  })
  .strict()
  .refine(
    (value) => {
      const days = (new Date(value.through).getTime() - new Date(value.from).getTime()) / 86400000;
      return days >= 0 && days <= 7;
    },
    { path: ["through"], message: "Consulte até uma semana por vez." },
  );

export const studentIntakeEnrollSchema = z
  .object({
    commandId: z.string().uuid(),
    candidateId: z.string().uuid().nullable(),
    student: studentCreateInputSchema,
    classId: z.string().uuid().nullable(),
    stageId: z.string().uuid().nullable(),
    contract: createMonthlyContractInputSchema.nullable().default(null),
    allowPending: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, context) => {
    if ((!value.classId || !value.contract) && !value.allowPending)
      context.addIssue({
        code: "custom",
        path: ["allowPending"],
        message: "Confirme o cadastro com pendências.",
      });
    if (
      value.contract &&
      (!value.contract.newStudent ||
        value.contract.studentId ||
        value.contract.renewedFromId ||
        value.contract.commandId === value.commandId)
    )
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
    studentId: z.string().uuid(),
    contact: studentUpdateContactInputSchema,
    classId: z.string().uuid().nullable(),
    stageId: z.string().uuid().nullable(),
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
