import { z, civilDateSchema, timeOfDaySchema } from "@lazuli/validators";

const id = z.string().uuid();
export const extraClassesSchema = z.object({
  id,
  classId: id,
  teacherId: id,
  from: civilDateSchema,
  through: civilDateSchema,
  weekdays: z.array(z.enum(["1", "2", "3", "4", "5", "6", "7"])).min(1).max(7),
  startTime: timeOfDaySchema,
  endTime: timeOfDaySchema,
  reason: z.string().trim().min(3, "Explique o motivo das aulas extras.").max(2000),
  allowOutsidePeriod: z.boolean(),
  fingerprint: z.string().optional(),
}).strict().refine((v) => v.endTime > v.startTime, "O fim deve ser depois do início.")
  .refine((v) => v.through >= v.from && Date.parse(v.through) - Date.parse(v.from) <= 183 * 86400000,
    "Escolha um intervalo de até seis meses.");
export const endClassesSchema = z.object({
  classId: id,
  lastDate: civilDateSchema,
  reason: z.string().trim().min(3, "Explique o motivo do encerramento.").max(2000),
}).strict();
export const confirmEndClassesSchema = endClassesSchema.extend({
  fingerprint: z.string().min(1),
  confirmation: z.string(),
});
export type ExtraClassesInput = z.infer<typeof extraClassesSchema>;
export type EndClassesInput = z.infer<typeof endClassesSchema>;
