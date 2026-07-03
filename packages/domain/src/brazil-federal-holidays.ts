export type BrazilFederalHoliday = {
  date: string;
  reason: string;
};

const FIXED_FEDERAL_HOLIDAYS: readonly { monthDay: string; reason: string }[] = [
  { monthDay: "01-01", reason: "Confraternizacao Universal" },
  { monthDay: "04-21", reason: "Tiradentes" },
  { monthDay: "05-01", reason: "Dia do Trabalho" },
  { monthDay: "09-07", reason: "Independencia do Brasil" },
  { monthDay: "10-12", reason: "Nossa Senhora Aparecida" },
  { monthDay: "11-02", reason: "Finados" },
  { monthDay: "11-15", reason: "Proclamacao da Republica" },
  { monthDay: "11-20", reason: "Dia Nacional de Zumbi e da Consciencia Negra" },
  { monthDay: "12-25", reason: "Natal" },
];

export function brazilFederalHolidaysForYear(year: number): BrazilFederalHoliday[] {
  return FIXED_FEDERAL_HOLIDAYS.map((holiday) => ({
    date: `${year}-${holiday.monthDay}`,
    reason: holiday.reason,
  }));
}
