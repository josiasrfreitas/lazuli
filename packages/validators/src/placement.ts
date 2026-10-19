import { z } from "zod";
import { civilDateSchema } from "./civil-date.js";
import { timeOfDaySchema, classFormatSchema } from "./class.js";

const MAX_CALENDAR_SPAN_MS = 6 * 24 * 60 * 60 * 1000;

export const placementCalendarSchema = z.object({
  candidateId: z.string().uuid().optional(),
  from: civilDateSchema,
  through: civilDateSchema,
}).strict().refine(value => value.from <= value.through &&
  Date.parse(value.through) - Date.parse(value.from) <= MAX_CALENDAR_SPAN_MS, {
  path: ["through"], message: "Consulte um período de até sete dias.",
});

export const placementScheduleSchema = z.object({
  id: z.string().uuid(),
  candidateId: z.string().uuid(),
  date: civilDateSchema,
  startTime: timeOfDaySchema,
  endTime: timeOfDaySchema,
  format: classFormatSchema,
}).strict().refine(value => value.startTime < value.endTime, {
  path: ["endTime"], message: "O término deve ser posterior ao início.",
});
export const MAX_PLACEMENT_FILE_BYTES = 5 * 1024 * 1024;
export const placementFileSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string().trim().min(1).max(180),
  contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  base64: z.string().min(4).max(Math.ceil(MAX_PLACEMENT_FILE_BYTES / 3) * 4)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
}).strict();
export const placementResultSchema = z.object({
  id: z.string().uuid(),
  stageId: z.string().uuid(),
  notes: z.string().trim().max(2000).default(""),
}).strict();
