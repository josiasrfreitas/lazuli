import { z } from "zod";
const MAX_SEARCH_LENGTH = 120;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
export const activityListSchema = z
  .object({
    search: z.string().trim().max(MAX_SEARCH_LENGTH).default(""),
    area: z.enum(["ALL", "PEDAGOGICAL", "COMMERCIAL", "FINANCIAL", "SCHOOL"]).default("ALL"),
    period: z.enum(["TODAY", "7", "30", "90", "ALL"]).default("30"),
    actorId: z.string().uuid().optional(),
    cursor: z
      .object({ id: z.string().uuid(), occurredAt: z.coerce.date(), snapshotAt: z.coerce.date() })
      .strict()
      .nullish(),
    direction: z.literal("forward").optional(),
    pageSize: z.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .strict();
export type ActivityListInput = z.infer<typeof activityListSchema>;
