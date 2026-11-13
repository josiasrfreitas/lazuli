import { z, civilDateSchema } from "@lazuli/validators";

const calendarDate = civilDateSchema.refine(
  (value) => value >= "2000-01-01" && value <= "2100-12-31",
  "Informe uma data entre 2000 e 2100.",
);
const revision = z.string().datetime({ offset: true });
const interruption = z.object({
  kind: z.enum(["HOLIDAY", "RECESS", "MAINTENANCE", "OTHER"]),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable(),
  from: calendarDate,
  through: calendarDate,
});

export const calendarChangeSchema = z
  .discriminatedUnion("action", [
    z
      .object({
        action: z.literal("period"),
        id: z.string().uuid().optional(),
        expectedUpdatedAt: revision.optional(),
        name: z.string().trim().min(1).max(80),
        from: calendarDate,
        through: calendarDate,
      })
      .strict(),
    interruption
      .extend({
        action: z.literal("interruption"),
        id: z.string().uuid().optional(),
        expectedUpdatedAt: revision.optional(),
      })
      .strict(),
    z
      .object({
        action: z.literal("removeInterruption"),
        id: z.string().uuid(),
        expectedUpdatedAt: revision,
      })
      .strict(),
    z
      .object({
        action: z.literal("holidays"),
        dates: z
          .array(
            z
              .object({
                date: calendarDate,
                title: z.string().trim().min(1).max(160),
                sourceKey: z.string().max(120),
              })
              .strict(),
          )
          .min(1)
          .max(40),
      })
      .strict(),
  ])
  .superRefine((value, context) => {
    if (value.action === "period" || value.action === "interruption") {
      if (Boolean(value.id) !== Boolean(value.expectedUpdatedAt))
        context.addIssue({
          code: "custom",
          path: ["expectedUpdatedAt"],
          message: "Reabra o formulário para carregar a versão atual.",
        });
      if (
        value.through < value.from ||
        (Date.parse(value.through) - Date.parse(value.from)) / 86400000 > 365
      )
        context.addIssue({
          code: "custom",
          path: ["through"],
          message: "Informe um intervalo de até 366 dias, com o fim posterior ao início.",
        });
    }
    if (
      value.action === "holidays" &&
      new Set(value.dates.map((item) => item.date.slice(0, 4))).size !== 1
    )
      context.addIssue({
        code: "custom",
        path: ["dates"],
        message: "Importe feriados de um ano por vez.",
      });
  });
export type CalendarChange = z.infer<typeof calendarChangeSchema>;

export const confirmCalendarChangeSchema = z
  .object({
    change: calendarChangeSchema,
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    commandId: z.string().uuid(),
  })
  .strict();
