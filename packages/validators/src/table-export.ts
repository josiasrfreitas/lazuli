import { z } from "zod";
import { studentListInputSchema } from "./student-list.js";
import { classListInputSchema } from "./class.js";
import { teacherListInputSchema } from "./teacher.js";
import { admissionListSchema } from "./admissions.js";
import { listContractsInputSchema } from "./contracts.js";
import { financeInstallmentsInputSchema, contractClosingsInputSchema } from "./finance.js";

export const exportListingSchema = z.discriminatedUnion("listing", [
  z.object({ listing: z.literal("Alunos"), filters: studentListInputSchema }),
  z.object({ listing: z.literal("Turmas"), filters: classListInputSchema }),
  z.object({ listing: z.literal("Professores"), filters: teacherListInputSchema }),
  z.object({ listing: z.literal("Leads"), filters: admissionListSchema }),
  z.object({ listing: z.literal("Contratos"), filters: listContractsInputSchema }),
  z.object({ listing: z.literal("Recebíveis"), filters: financeInstallmentsInputSchema }),
  z.object({ listing: z.literal("Fluxo de caixa"), filters: contractClosingsInputSchema }),
  z.object({ listing: z.literal("Contratos fechados"), filters: contractClosingsInputSchema }),
  z.object({
    listing: z.literal("Estágios"),
    filters: z.object({ search: z.string().max(1000), legacy: z.boolean() }),
  }),
]);
export const tableExportSchema = z.object({
  source: exportListingSchema,
  criteria: z.array(z.tuple([z.string().max(128), z.string().max(16000)])).max(32),
});
export type TableExportRequest = z.infer<typeof tableExportSchema>;
