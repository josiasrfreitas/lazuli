import { priceAfterDiscountCents } from "./monthly-contract.js";

const RATE_SCALE = 10_000;
const PERCENT = 100;
const ROUNDING_DIVISOR = 2n;
const DAYS_PER_INTEREST_MONTH = 30;
const DENOMINATOR = BigInt(RATE_SCALE * PERCENT * DAYS_PER_INTEREST_MONTH);
const MILLISECONDS_PER_DAY = 86_400_000;

type InterestTerms = { dueDate: string; monthlyPct: number };

function roundedInterest(value: bigint): number {
  return Number((value + DENOMINATOR / ROUNDING_DIVISOR) / DENOMINATOR);
}

function accrueInterest(input: {
  terms: InterestTerms;
  from: string;
  through: string;
  principalCents: number;
}): bigint {
  const { terms, through, principalCents } = input;
  let from = input.from;
  if (from < terms.dueDate) from = terms.dueDate;
  if (through <= from) return 0n;
  const days = (Date.parse(through) - Date.parse(from)) / MILLISECONDS_PER_DAY;
  return BigInt(principalCents) * BigInt(Math.round(terms.monthlyPct * RATE_SCALE)) * BigInt(days);
}

export type SettlementPayment = { date: string; amountCents: number; recordedAt?: string };
export type SettlementInput = {
  nominalCents: number;
  terms: InterestTerms & { discountPct: number };
  payments: SettlementPayment[];
  principalAdjustments: SettlementPayment[];
  postedInterestCents: number;
  chargeAdjustments?: SettlementPayment[];
  suspensions?: { date: string; newDueDate: string; recordedAt?: string }[];
  effectiveDate: string;
  receivedCents?: number | undefined;
};
export type SettlementQuote = {
  balanceCents: number;
  newInterestCents: number;
  discountCents: number;
  settlementCents: number;
  receivedCents: number;
  remainingCents: number;
  outstandingChargesCents: number;
};
type AccrualState = {
  principal: number;
  interest: bigint;
  paidInterest: number;
  date: string;
  charges: number;
  dueDate: string;
};

/** Read-only calculation for one installment; never rewrites earlier financial facts. */
export function quoteSettlement(input: SettlementInput): SettlementQuote {
  const paid = input.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  const balanceCents = input.nominalCents + recordedAdjustments(input) - paid;
  const accrued = interestThroughDate(input);
  const newInterestCents =
    balanceCents > 0 ? Math.max(0, accrued.total - input.postedInterestCents) : 0;
  const eligibleDiscount = discountAvailable(input, paid);
  const settlementCents = Math.max(0, balanceCents + newInterestCents - eligibleDiscount);
  const receivedCents = input.receivedCents ?? settlementCents;
  const discountCents = receivedCents >= settlementCents ? eligibleDiscount : 0;
  return {
    balanceCents,
    newInterestCents,
    discountCents,
    settlementCents,
    receivedCents,
    remainingCents: balanceCents + newInterestCents - discountCents - receivedCents,
    outstandingChargesCents: Math.max(
      0,
      Math.min(balanceCents + newInterestCents, accrued.outstanding),
    ),
  };
}

function discountAvailable(input: SettlementInput, paid: number): number {
  if (input.suspensions?.length || input.chargeAdjustments?.length) return 0;
  if (input.effectiveDate > input.terms.dueDate || recordedAdjustments(input) !== 0) return 0;
  const discounted = priceAfterDiscountCents(input.nominalCents, input.terms.discountPct);
  if (paid >= discounted) return 0;
  return input.nominalCents - discounted;
}

export type SettlementInterestPeriod = {
  from: string;
  through: string;
  days: number;
  principalCents: number;
  dailyInterestCents: number;
};

/** Explains the same dated principal history used by the settlement calculator. */
export function settlementInterestDetails(input: SettlementInput): {
  monthlyPct: number;
  dailyPct: number;
  overdueDays: number;
  postedInterestCents: number;
  accruedInterestCents: number;
  periods: SettlementInterestPeriod[];
} {
  const periods: SettlementInterestPeriod[] = [];
  const accrued = interestThroughDate(input, periods);
  return {
    monthlyPct: input.terms.monthlyPct,
    dailyPct: input.terms.monthlyPct / DAYS_PER_INTEREST_MONTH,
    overdueDays: Math.max(
      0,
      (Date.parse(input.effectiveDate) - Date.parse(input.terms.dueDate)) / MILLISECONDS_PER_DAY,
    ),
    postedInterestCents: input.postedInterestCents,
    accruedInterestCents: accrued.total,
    periods,
  };
}

function recordInterestPeriod(
  periods: SettlementInterestPeriod[] | undefined,
  state: AccrualState,
  through: string,
  monthlyPct: number,
): void {
  const from = state.date > state.dueDate ? state.date : state.dueDate;
  if (!periods || through <= from || state.principal <= 0 || monthlyPct <= 0) return;
  const days = (Date.parse(through) - Date.parse(from)) / MILLISECONDS_PER_DAY;
  const previous = periods.at(-1);
  if (previous?.through === from && previous.principalCents === state.principal) {
    previous.through = through;
    previous.days += days;
    return;
  }
  periods.push({
    from,
    through,
    days,
    principalCents: state.principal,
    dailyInterestCents: (state.principal * monthlyPct) / PERCENT / DAYS_PER_INTEREST_MONTH,
  });
}

function interestThroughDate(
  input: SettlementInput,
  periods?: SettlementInterestPeriod[],
): { total: number; outstanding: number } {
  let state: AccrualState = {
    principal: input.nominalCents,
    interest: 0n,
    paidInterest: 0,
    date: input.terms.dueDate,
    dueDate: input.terms.dueDate,
    charges: 0,
  };
  for (const fact of orderedFacts(input)) {
    if (fact.date > input.effectiveDate) throw new Error("Pagamento anterior a fato já efetivado.");
    recordInterestPeriod(periods, state, fact.date, input.terms.monthlyPct);
    state = applyHistoricalFact({ state, fact, terms: input.terms });
  }
  const increment = accrueInterest({
    terms: { ...input.terms, dueDate: state.dueDate },
    from: state.date,
    through: input.effectiveDate,
    principalCents: state.principal,
  });
  recordInterestPeriod(periods, state, input.effectiveDate, input.terms.monthlyPct);
  const total = roundedInterest(state.interest + increment);
  return { total, outstanding: total + state.charges - state.paidInterest };
}

function applyHistoricalFact(input: {
  state: AccrualState;
  fact: SettlementFact;
  terms: InterestTerms;
}): AccrualState {
  const { state, fact } = input;
  const increment = accrueInterest({
    terms: { ...input.terms, dueDate: state.dueDate },
    from: state.date,
    through: fact.date,
    principalCents: state.principal,
  });
  const interest = state.interest + increment;
  if (fact.kind === "suspension") {
    return { ...state, interest, date: fact.date, dueDate: fact.newDueDate };
  }
  if (fact.kind === "charge") {
    return { ...state, interest, date: fact.date, charges: state.charges + fact.amountCents };
  }
  if (fact.kind === "adjustment") {
    return {
      ...state,
      principal: Math.max(0, state.principal + fact.amountCents),
      interest,
      date: fact.date,
    };
  }
  const unpaidInterest = Math.max(
    0,
    roundedInterest(interest) + state.charges - state.paidInterest,
  );
  const interestPaid = Math.min(fact.amountCents, unpaidInterest);
  return {
    ...state,
    principal: Math.max(0, state.principal - (fact.amountCents - interestPaid)),
    interest,
    paidInterest: state.paidInterest + interestPaid,
    date: fact.date,
  };
}

type SettlementFact =
  | (SettlementPayment & { kind: "payment" | "adjustment" | "charge" })
  | { kind: "suspension"; date: string; newDueDate: string; recordedAt?: string };
function orderedFacts(input: SettlementInput): SettlementFact[] {
  const facts: SettlementFact[] = [
    ...input.principalAdjustments.map((fact) => ({ ...fact, kind: "adjustment" as const })),
    ...(input.chargeAdjustments ?? []).map((fact) => ({ ...fact, kind: "charge" as const })),
    ...(input.suspensions ?? []).map((fact) => ({ ...fact, kind: "suspension" as const })),
    ...input.payments.map((fact) => ({ ...fact, kind: "payment" as const })),
  ];
  const result: SettlementFact[] = [];
  for (const fact of facts) {
    const index = result.findIndex(
      (entry) =>
        entry.date > fact.date ||
        (entry.date === fact.date &&
          entry.recordedAt !== undefined &&
          fact.recordedAt !== undefined &&
          entry.recordedAt > fact.recordedAt),
    );
    result.splice(index === -1 ? result.length : index, 0, fact);
  }
  return result;
}
function recordedAdjustments(input: SettlementInput): number {
  return (
    input.postedInterestCents +
    (input.chargeAdjustments ?? []).reduce((sum, fact) => sum + fact.amountCents, 0) +
    input.principalAdjustments.reduce((sum, fact) => sum + fact.amountCents, 0)
  );
}
