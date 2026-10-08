import { addCalendarMonths, priceAfterDiscountCents } from "./monthly-contract.js";

const RATE_SCALE = 10_000;
const PERCENT = 100;
const ROUNDING_DIVISOR = 2n;
const DENOMINATOR = BigInt(RATE_SCALE * PERCENT);
const MILLISECONDS_PER_DAY = 86_400_000;

type InterestTotals = { daily: bigint; monthly: bigint };
type InterestTerms = { dueDate: string; dailyPct: number; monthlyPct: number };

function roundedInterest(value: bigint): number {
  return Number((value + DENOMINATOR / ROUNDING_DIVISOR) / DENOMINATOR);
}

function accrueInterest(input: {
  terms: InterestTerms;
  from: string;
  through: string;
  principalCents: number;
}): InterestTotals {
  const { terms, through, principalCents } = input;
  let from = input.from;
  if (from < terms.dueDate) from = terms.dueDate;
  if (through <= from) return { daily: 0n, monthly: 0n };
  const days = (Date.parse(through) - Date.parse(from)) / MILLISECONDS_PER_DAY;
  let anniversaries = 0;
  for (let month = 1; addCalendarMonths(terms.dueDate, month) <= through; month++) {
    if (addCalendarMonths(terms.dueDate, month) > from) anniversaries++;
  }
  const principal = BigInt(principalCents);
  return {
    daily: principal * BigInt(Math.round(terms.dailyPct * RATE_SCALE)) * BigInt(days),
    monthly: principal * BigInt(Math.round(terms.monthlyPct * RATE_SCALE)) * BigInt(anniversaries),
  };
}

export type SettlementPayment = { date: string; amountCents: number };
export type SettlementInput = {
  nominalCents: number;
  terms: InterestTerms & { discountPct: number };
  payments: SettlementPayment[];
  principalAdjustments: SettlementPayment[];
  postedInterestCents: number;
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
};
type AccrualState = {
  principal: number;
  daily: bigint;
  monthly: bigint;
  paidInterest: number;
  date: string;
};

/** Read-only calculation for one installment; never rewrites earlier financial facts. */
export function quoteSettlement(input: SettlementInput): SettlementQuote {
  const paid = input.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  const balanceCents = input.nominalCents + recordedAdjustments(input) - paid;
  const newInterestCents =
    balanceCents > 0 ? Math.max(0, interestThroughDate(input) - input.postedInterestCents) : 0;
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
  };
}

function discountAvailable(input: SettlementInput, paid: number): number {
  if (input.effectiveDate > input.terms.dueDate || recordedAdjustments(input) !== 0) return 0;
  const discounted = priceAfterDiscountCents(input.nominalCents, input.terms.discountPct);
  if (paid >= discounted) return 0;
  return input.nominalCents - discounted;
}

function interestThroughDate(input: SettlementInput): number {
  let state: AccrualState = {
    principal: input.nominalCents,
    daily: 0n,
    monthly: 0n,
    paidInterest: 0,
    date: input.terms.dueDate,
  };
  for (const fact of orderedFacts(input)) {
    if (fact.date > input.effectiveDate) throw new Error("Pagamento anterior a fato já efetivado.");
    state = applyHistoricalFact({ state, fact, terms: input.terms });
  }
  const increment = accrueInterest({
    terms: input.terms,
    from: state.date,
    through: input.effectiveDate,
    principalCents: state.principal,
  });
  return (
    roundedInterest(state.daily + increment.daily) +
    roundedInterest(state.monthly + increment.monthly)
  );
}

function applyHistoricalFact(input: {
  state: AccrualState;
  fact: SettlementFact;
  terms: InterestTerms;
}): AccrualState {
  const { state, fact } = input;
  const increment = accrueInterest({
    terms: input.terms,
    from: state.date,
    through: fact.date,
    principalCents: state.principal,
  });
  const daily = state.daily + increment.daily;
  const monthly = state.monthly + increment.monthly;
  if (fact.kind === "adjustment") {
    return {
      ...state,
      principal: Math.max(0, state.principal + fact.amountCents),
      daily,
      monthly,
      date: fact.date,
    };
  }
  const unpaidInterest = roundedInterest(daily) + roundedInterest(monthly) - state.paidInterest;
  const interestPaid = Math.min(fact.amountCents, unpaidInterest);
  return {
    principal: Math.max(0, state.principal - (fact.amountCents - interestPaid)),
    daily,
    monthly,
    paidInterest: state.paidInterest + interestPaid,
    date: fact.date,
  };
}

type SettlementFact = SettlementPayment & { kind: "payment" | "adjustment" };
function orderedFacts(input: SettlementInput): SettlementFact[] {
  const facts: SettlementFact[] = [
    ...input.principalAdjustments.map((fact) => ({ ...fact, kind: "adjustment" as const })),
    ...input.payments.map((fact) => ({ ...fact, kind: "payment" as const })),
  ];
  const result: SettlementFact[] = [];
  for (const fact of facts) {
    const index = result.findIndex((entry) => entry.date > fact.date);
    result.splice(index === -1 ? result.length : index, 0, fact);
  }
  return result;
}
function recordedAdjustments(input: SettlementInput): number {
  return (
    input.postedInterestCents +
    input.principalAdjustments.reduce((sum, fact) => sum + fact.amountCents, 0)
  );
}
