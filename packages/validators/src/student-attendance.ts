import { z } from "zod";
const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;
const MAX_LOCATION_ACCURACY = 100_000;
const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 120;
export const PRESENTIAL_WINDOW_MINUTES = 5;
const SHORT_ONLINE_MINUTES = 10;
const MEDIUM_ONLINE_MINUTES = 20;
const LONG_ONLINE_MINUTES = 30;
export const ONLINE_WINDOW_MINUTES = [
  SHORT_ONLINE_MINUTES,
  MEDIUM_ONLINE_MINUTES,
  LONG_ONLINE_MINUTES,
] as const;
const MIN_RADIUS = 10;
const MAX_RADIUS = 1000;
const MIN_ACCURACY = 5;
const MAX_ACCURACY = 500;
export const attendanceSettingsSchema = z
  .object({
    latitude: z.number().finite().min(-MAX_LATITUDE).max(MAX_LATITUDE),
    longitude: z.number().finite().min(-MAX_LONGITUDE).max(MAX_LONGITUDE),
    radiusMeters: z.number().int().min(MIN_RADIUS).max(MAX_RADIUS),
    maxAccuracyMeters: z.number().int().min(MIN_ACCURACY).max(MAX_ACCURACY),
  })
  .strict();
export const attendanceLocationSchema = z
  .object({
    latitude: z.number().finite().min(-MAX_LATITUDE).max(MAX_LATITUDE),
    longitude: z.number().finite().min(-MAX_LONGITUDE).max(MAX_LONGITUDE),
    accuracy: z.number().finite().min(0).max(MAX_LOCATION_ACCURACY),
    capturedAt: z.string().datetime(),
  })
  .strict();
export const attendanceWindowTargetSchema = z.object({ sessionId: z.string().uuid() }).strict();
export const attendanceWindowOpenSchema = attendanceWindowTargetSchema.extend({
  minutes: z.union([
    z.literal(PRESENTIAL_WINDOW_MINUTES),
    z.literal(ONLINE_WINDOW_MINUTES[0]),
    z.literal(ONLINE_WINDOW_MINUTES[1]),
    z.literal(ONLINE_WINDOW_MINUTES[2]),
  ]),
  location: attendanceLocationSchema.nullable(),
  projectionToken: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/u)
    .optional(),
});
export const attendanceTokenSchema = z
  .object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/u, "Link de presença inválido.") })
  .strict();
export const attendanceNameSearchSchema = attendanceTokenSchema.extend({
  name: z
    .string()
    .trim()
    .min(MIN_NAME_LENGTH, "Digite pelo menos três caracteres do seu nome.")
    .max(MAX_NAME_LENGTH),
});
export const attendanceDeclarationSchema = attendanceNameSearchSchema.extend({
  enrollmentId: z.string().uuid("Selecione seu nome."),
  browserId: z
    .string()
    .uuid("Permita o armazenamento deste navegador para confirmar sua presença."),
  location: attendanceLocationSchema.nullable(),
});
export type AttendanceLocation = z.infer<typeof attendanceLocationSchema>;
