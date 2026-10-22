import { z } from "zod";
import { civilDateSchema } from "./civil-date.js";
import { timeOfDaySchema, classFormatSchema } from "./class.js";
import { MAX_UPLOAD_FILE_BYTES } from "./file-upload.js";

const MAX_FILE_NAME_LENGTH = 180;
const BASE64_BLOCK_LENGTH = 4;
const BASE64_BLOCK_BYTES = 3;
const MAX_NOTES_LENGTH = 2000;

const MAX_CALENDAR_SPAN_MS = 518_400_000;

export const placementCalendarSchema = z
  .object({
    candidateId: z.string().uuid().optional(),
    from: civilDateSchema,
    through: civilDateSchema,
  })
  .strict()
  .refine(
    (value) =>
      value.from <= value.through &&
      Date.parse(value.through) - Date.parse(value.from) <= MAX_CALENDAR_SPAN_MS,
    {
      path: ["through"],
      message: "Consulte um período de até sete dias.",
    },
  );

export const placementScheduleSchema = z
  .object({
    id: z.string().uuid(),
    candidateId: z.string().uuid(),
    date: civilDateSchema,
    startTime: timeOfDaySchema,
    endTime: timeOfDaySchema,
    format: classFormatSchema,
  })
  .strict()
  .refine((value) => value.startTime < value.endTime, {
    path: ["endTime"],
    message: "O término deve ser posterior ao início.",
  });
export const MAX_PLACEMENT_FILE_BYTES = MAX_UPLOAD_FILE_BYTES;
export const placementDownloadSchema = z
  .object({
    id: z.string().uuid(),
    kind: z.enum(["ORIGINAL", "CORRECTED"]).default("ORIGINAL"),
  })
  .strict();
export const placementFileSchema = z
  .object({
    id: z.string().uuid(),
    kind: z.enum(["ORIGINAL", "CORRECTED"]).default("ORIGINAL"),
    fileName: z.string().trim().min(1).max(MAX_FILE_NAME_LENGTH),
    contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
    base64: z
      .string()
      .min(BASE64_BLOCK_LENGTH)
      .max(Math.ceil(MAX_PLACEMENT_FILE_BYTES / BASE64_BLOCK_BYTES) * BASE64_BLOCK_LENGTH)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/)
      .refine((value) => value.length % BASE64_BLOCK_LENGTH === 0, "Conteúdo do arquivo inválido."),
  })
  .strict();
export const placementResultSchema = z
  .object({
    id: z.string().uuid(),
    stageId: z.string().uuid(),
    notes: z.string().trim().max(MAX_NOTES_LENGTH).default(""),
  })
  .strict();
