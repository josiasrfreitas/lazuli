import { z } from "zod";
export const attendanceLocationSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    accuracy: z.number().finite().min(0).max(100_000),
    capturedAt: z.string().datetime(),
  })
  .strict();
export const attendanceWindowTargetSchema = z.object({ sessionId: z.string().uuid() }).strict();
export const attendanceWindowOpenSchema = attendanceWindowTargetSchema.extend({
  minutes: z.union([z.literal(5), z.literal(10), z.literal(20), z.literal(30)]),
  location: attendanceLocationSchema.nullable(),
  projectionToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/u).optional(),
});
export const attendanceTokenSchema = z
  .object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/u, "Link de presença inválido.") })
  .strict();
export const attendanceNameSearchSchema = attendanceTokenSchema.extend({
  name: z.string().trim().min(3, "Digite pelo menos três caracteres do seu nome.").max(120),
});
export const attendanceDeclarationSchema = attendanceNameSearchSchema.extend({
  enrollmentId: z.string().uuid("Selecione seu nome."),
  browserId: z.string().uuid("Permita o armazenamento deste navegador para confirmar sua presença."),
  location: attendanceLocationSchema.nullable(),
});
export type AttendanceLocation = z.infer<typeof attendanceLocationSchema>;
