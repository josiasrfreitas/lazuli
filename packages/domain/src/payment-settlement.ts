import { priceAfterDiscountCents } from "./monthly-contract.js";
import { accrueInterest, roundedInterest, type InterestTerms } from "./payment-interest.js";

export type SettlementPayment = { date: string; amountCents: number };
export type SettlementInput = {
  nominalCents: number;
  terms: InterestTerms & { discountPct: number };
  payments: SettlementPayment[];
  adjustmentCents: number;
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
  const balanceCents = input.nominalCents + input.adjustmentCents - paid;
  const accrued = interestThroughDate(input);
  const newInterestCents = Math.max(0, accrued - input.postedInterestCents);
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
  if (input.effectiveDate > input.terms.dueDate || input.adjustmentCents !== 0) return 0;
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
  for (const payment of orderedPayments(input.payments)) {
    if (payment.date > input.effectiveDate)
      throw new Error("Pagamento anterior a fato já efetivado.");
    state = applyHistoricalPayment({ state, payment, terms: input.terms });
  }
  // Applied discounts/corrections reduce principal, never turn accrued interest into principal.
  state.principal = Math.max(
    0,
    state.principal + input.adjustmentCents - input.postedInterestCents,
  );
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

function applyHistoricalPayment(input: {
  state: AccrualState;
  payment: SettlementPayment;
  terms: InterestTerms;
}): AccrualState {
  const { state, payment } = input;
  const increment = accrueInterest({
    terms: input.terms,
    from: state.date,
    through: payment.date,
    principalCents: state.principal,
  });
  const daily = state.daily + increment.daily;
  const monthly = state.monthly + increment.monthly;
  const unpaidInterest = roundedInterest(daily) + roundedInterest(monthly) - state.paidInterest;
  const interestPaid = Math.min(payment.amountCents, unpaidInterest);
  return {
    principal: Math.max(0, state.principal - (payment.amountCents - interestPaid)),
    daily,
    monthly,
    paidInterest: state.paidInterest + interestPaid,
    date: payment.date,
  };
}

function orderedPayments(payments: SettlementPayment[]): SettlementPayment[] {
  const result: SettlementPayment[] = [];
  for (const payment of payments) {
    const index = result.findIndex((entry) => entry.date > payment.date);
    result.splice(index < 0 ? result.length : index, 0, payment);
  }
  return result;
}
