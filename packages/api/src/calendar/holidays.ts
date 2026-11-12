import { z, civilDateSchema } from "@lazuli/validators";
import { brazilFederalHolidaysForYear } from "@lazuli/domain";

export async function holidaySuggestions(year: number, state: string) {
  let source = "BrasilAPI";
  let days: Array<{ date: string; title: string; sourceKey: string }>;
  try {
    const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("HOLIDAY_SOURCE_UNAVAILABLE");
    const values = z
      .array(z.object({ date: civilDateSchema, name: z.string().min(1).max(160) }))
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
  if (state === "SE" && year === 2026)
    days.push({
      date: "2026-07-08",
      title: "Emancipação Política de Sergipe",
      sourceKey: "BR-SE:2026-07-08",
    });
  return {
    source,
    days: days.sort((a, b) => a.date.localeCompare(b.date)),
    stateCovered: state === "SE" && year === 2026,
    stateSource:
      state === "SE" && year === 2026
        ? "https://sergipe.se.gov.br/secom/noticia/governo_de_sergipe_publica_decreto_com_feriados_e_pontos_facultativos_de_2026"
        : null,
  };
}
