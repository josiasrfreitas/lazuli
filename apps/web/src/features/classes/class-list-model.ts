import { classListInputSchema, z } from "@lazuli/validators";

export type ClassListParams = {
  busca: string;
  tipo: string | null;
  formato: string | null;
  professor: string | null;
  estagio: string | null;
  semestre: string | null;
  estado: string | null;
  pagina: number;
};

export const CLEAR_CLASS_FILTERS: Partial<ClassListParams> = {
  tipo: null,
  formato: null,
  professor: null,
  estagio: null,
  semestre: null,
  estado: null,
  pagina: 1,
};

function selectedValues<T>(value: string | null, schema: z.ZodType<T>): T[] {
  return [...new Set(value?.split(",") ?? [])].flatMap((item) => {
    const result = schema.safeParse(item);
    return result.success ? [result.data] : [];
  });
}

export function classListQueryInput(params: ClassListParams): z.infer<typeof classListInputSchema> {
  const fields = classListInputSchema.shape;
  return {
    search: params.busca,
    page: params.pagina,
    pageSize: 20,
    scheduleTypes: selectedValues(params.tipo, fields.scheduleTypes.removeDefault().element),
    formats: selectedValues(params.formato, fields.formats.removeDefault().element),
    teacherIds: selectedValues(params.professor, fields.teacherIds.removeDefault().element),
    stageIds: selectedValues(params.estagio, fields.stageIds.removeDefault().element),
    semesterIds: selectedValues(params.semestre, fields.semesterIds.removeDefault().element),
    statuses: selectedValues(params.estado, fields.statuses.removeDefault().element),
  };
}

export function classListReturnUrl(params: ClassListParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== "") query.set(key, String(value));
  }
  return `/turmas?${query}`;
}
