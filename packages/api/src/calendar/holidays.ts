import { z, civilDateSchema } from "@lazuli/validators";
import { brazilFederalHolidaysForYear } from "@lazuli/domain";

const HOLIDAY_TIMEOUT_MILLISECONDS = 8000;
const HOLIDAY_TITLE_LIMIT = 160;
const SERGIPE_COVERED_YEAR = 2026;
type HolidayDay = { date: string; title: string; sourceKey: string };
type HolidaySuggestions = {
  source: string;
  days: HolidayDay[];
  stateCovered: boolean;
  stateSource: string | null;
};
export async function holidaySuggestions(year: number, state: string): Promise<HolidaySuggestions> {
  let source = "BrasilAPI";
  let days: Array<{ date: string; title: string; sourceKey: string }>;
  try {
    const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`, {
      signal: AbortSignal.timeout(HOLIDAY_TIMEOUT_MILLISECONDS),
    });
    if (!response.ok) throw new Error("HOLIDAY_SOURCE_UNAVAILABLE");
    const values = z
      .array(z.object({ date: civilDateSchema, name: z.string().min(1).max(HOLIDAY_TITLE_LIMIT) }))
      .parse(await response.json());
    days = values
      .filter((row) => row.date.startsWith(`${year}-`))
      .map((row) => ({ date: row.date, title: row.name, sourceKey: `BR:${row.date}` }));
  } catch {
    source = "Datas nacionais fixas (BrasilAPI indisponível)";
    days = brazilFederalHolidaysForYear(year).map((row) => ({
      date: row.date,
      title: row.reason,
      sourceKey: `BR:${row.date}`,
    }));
  }
  if (state === "SE" && year === SERGIPE_COVERED_YEAR)
    days.push({
      date: "2026-07-08",
      title: "Emancipação Política de Sergipe",
      sourceKey: "BR-SE:2026-07-08",
    });
  return {
    source,
    days: days.toSorted((left, right) => left.date.localeCompare(right.date)),
    stateCovered: state === "SE" && year === SERGIPE_COVERED_YEAR,
    stateSource:
      state === "SE" && year === SERGIPE_COVERED_YEAR
        ? "https://sergipe.se.gov.br/secom/noticia/governo_de_sergipe_publica_decreto_com_feriados_e_pontos_facultativos_de_2026"
        : null,
  };
}
