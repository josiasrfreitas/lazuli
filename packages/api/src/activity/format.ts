const CENTS_PER_UNIT = 100;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function activityMoney(cents: number): string {
  return money.format(cents / CENTS_PER_UNIT);
}
