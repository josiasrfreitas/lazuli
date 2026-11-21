import { z } from "zod";
import { studentListInputSchema } from "./student-list.js";
import { classListInputSchema } from "./class.js";
import { teacherListInputSchema } from "./teacher.js";
import { admissionListSchema } from "./admissions.js";
import { listContractsInputSchema } from "./contracts.js";
import { financeInstallmentsInputSchema, contractClosingsInputSchema } from "./finance.js";

const MAX_STAGE_SEARCH_LENGTH = 1000;
const MAX_CRITERIA_COUNT = 32;
const MAX_CRITERION_LABEL_LENGTH = 128;
const MAX_CRITERION_VALUE_LENGTH = 16_000;

export const exportListingSchema = z.discriminatedUnion("listing", [
  z.object({ listing: z.literal("Alunos"), filters: studentListInputSchema }),
  z.object({ listing: z.literal("Turmas"), filters: classListInputSchema }),
  z.object({ listing: z.literal("Docentes"), filters: teacherListInputSchema }),
  z.object({ listing: z.literal("Professores"), filters: teacherListInputSchema }),
  z.object({ listing: z.literal("Leads"), filters: admissionListSchema }),
  z.object({ listing: z.literal("Contratos"), filters: listContractsInputSchema }),
  z.object({ listing: z.literal("Recebíveis"), filters: financeInstallmentsInputSchema }),
  z.object({ listing: z.literal("Fluxo de caixa"), filters: contractClosingsInputSchema }),
  z.object({ listing: z.literal("Contratos fechados"), filters: contractClosingsInputSchema }),
  z.object({
    listing: z.literal("Estágios"),
    filters: z.object({ search: z.string().max(MAX_STAGE_SEARCH_LENGTH), legacy: z.boolean() }),
  }),
]);
export const tableExportSchema = z.object({
  source: exportListingSchema,
  criteria: z
    .array(
      z.tuple([
        z.string().max(MAX_CRITERION_LABEL_LENGTH),
        z.string().max(MAX_CRITERION_VALUE_LENGTH),
      ]),
    )
    .max(MAX_CRITERIA_COUNT),
});
export type TableExportRequest = z.infer<typeof tableExportSchema>;
