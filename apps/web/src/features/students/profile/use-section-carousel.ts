import { useSectionCarousel as useCarousel } from "~/lib/use-section-carousel";

const SECTION_ORDER = ["visao-geral", "cadastro", "pedagogico", "planejamento", "financeiro"];

export function useSectionCarousel(): ReturnType<typeof useCarousel> {
  return useCarousel({ order: SECTION_ORDER, scope: "studentCarousel" });
}
