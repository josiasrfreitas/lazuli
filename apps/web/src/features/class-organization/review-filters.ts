import { normalizeSearch } from "@lazuli/domain";
import { parseAsBoolean, parseAsString, parseAsStringLiteral, type inferParserType } from "nuqs";
import { atRisk, significantReduction } from "./formation-calendar";
import { matchesFilter, rosterAttentionReasons, selectedReviewReasons } from "./attention-reasons";
import type { OrganizationBoard, Placement } from "./model";
import {
  isReviewDeparture,
  needsReviewDestination,
  reviewDestinationId,
  reviewGroupPlanId,
  reviewOriginName,
  reviewOriginPlans,
  reviewOrders,
  reviewPlanName,
} from "./review-group-model";

const scopes = ["pending", "ready", "blocked", "published", "all"] as const;
const departureFilters = ["possivel", "registrada", "todas"] as const;
export type ReviewScope = (typeof scopes)[number];
export type ReviewDepartureFilter = (typeof departureFilters)[number];
export const REVIEW_NO_STAGE = "undefined-stage";
export const REVIEW_NO_ORIGIN = "sem-origem";

export const reviewParsers = {
  busca: parseAsString.withDefault(""),
  vinculos: parseAsStringLiteral(scopes),
  destinoVinculo: parseAsString,
  estagioVinculo: parseAsString,
  origemVinculo: parseAsString,
  estagioOrigem: parseAsString,
  atencaoVinculo: parseAsString,
  professorVinculo: parseAsString,
  modalidadeVinculo: parseAsString,
  saidaVinculo: parseAsStringLiteral(departureFilters),
  reducaoSignificativa: parseAsBoolean.withDefault(false),
  turmasEmRisco: parseAsBoolean.withDefault(false),
  precisaTurma: parseAsBoolean.withDefault(false),
  ordemVinculos: parseAsStringLiteral(reviewOrders).withDefault("destino"),
};
export type ReviewCriteria = inferParserType<typeof reviewParsers>;
export type ChangeCriteria = (values: Partial<ReviewCriteria> | null) => void;
type WaitingLead = OrganizationBoard["waitingLeads"][number];

export type ReviewResults = {
  rows: Placement[];
  leads: WaitingLead[];
  counts: Record<ReviewScope, number>;
};

export function allowsAttention(scope: ReviewScope): boolean {
  return scope !== "ready" && scope !== "published";
}

export function matchesReviewScope(row: Placement, scope: ReviewScope): boolean {
  if (scope === "all") return true;
  if (row.declinedAt) return false;
  if (scope === "published") return row.confirmation === "CONFIRMED";
  if (row.confirmation === "CONFIRMED") return false;
  if (scope === "pending") return true;
  return row.confirmation === (scope === "ready" ? "PRECONFIRMED" : "BLOCKED");
}

function matchesOriginFilters(
  row: Pick<Placement, "sourceClassId" | "sourceStageId">,
  criteria: ReviewCriteria,
): boolean {
  if (criteria.origemVinculo && (row.sourceClassId ?? REVIEW_NO_ORIGIN) !== criteria.origemVinculo)
    return false;
  return !criteria.estagioOrigem || row.sourceStageId === criteria.estagioOrigem;
}

function matchesDestinationFilters(row: Placement, criteria: ReviewCriteria): boolean {
  if (
    criteria.estagioVinculo &&
    (row.declinedAt || (row.stageId ?? REVIEW_NO_STAGE) !== criteria.estagioVinculo)
  )
    return false;
  return !criteria.destinoVinculo || reviewDestinationId(row) === criteria.destinoVinculo;
}

export function reviewStudentReasonKeys(row: Placement): string[] {
  if (row.declinedAt) return [];
  const keys = rosterAttentionReasons(row).map((reason) => reason.risk ?? reason.kind);
  return [
    ...new Set(
      keys.flatMap((key) =>
        key === "unassigned" ? (isReviewDeparture(row) ? [] : ["noDestination"]) : [key],
      ),
    ),
  ];
}

export function reviewLeadReasonKeys(lead: WaitingLead): string[] {
  return lead.allocationPlanId ? ["waitingLead"] : ["waitingLead", "noDestination"];
}

function matchesAttention(row: Placement, selected: string[]): boolean {
  if (selected.length === 0) return true;
  if (row.declinedAt) return false;
  const keys = reviewStudentReasonKeys(row);
  return selected.some((key) => {
    if (key === "pending") return matchesFilter(row, "pending");
    if (key === "unassigned") return needsReviewDestination(row);
    return keys.includes(key);
  });
}

function matchesDeparture(row: Placement, filter: ReviewDepartureFilter | null): boolean {
  if (!filter) return true;
  if (filter === "registrada") return Boolean(row.declinedAt);
  if (filter === "possivel") return isReviewDeparture(row) && !row.declinedAt;
  return isReviewDeparture(row);
}

function matchesLeadFilters(lead: WaitingLead, criteria: ReviewCriteria): boolean {
  if (criteria.saidaVinculo) return false;
  if (!matchesOriginFilters({ sourceClassId: null, sourceStageId: null }, criteria)) return false;
  if (criteria.estagioVinculo && (lead.stageId ?? REVIEW_NO_STAGE) !== criteria.estagioVinculo)
    return false;
  if (criteria.destinoVinculo && lead.allocationPlanId !== criteria.destinoVinculo) return false;
  return !criteria.precisaTurma || !lead.allocationPlanId;
}

function matchesLeadAttention(lead: WaitingLead, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const keys = reviewLeadReasonKeys(lead);
  return selected.some(
    (key) => key === "pending" || keys.includes(key === "unassigned" ? "noDestination" : key),
  );
}

type ReviewSearch = {
  name: string;
  matchingPlans: Set<string>;
  origins: ReturnType<typeof reviewOriginPlans>;
};

function matchesReviewSearch(
  row: Placement,
  { name, matchingPlans, origins }: ReviewSearch,
): boolean {
  if (normalizeSearch(row.studentName).includes(name)) return true;
  const destination = row.publishedAt ? row.planId : reviewDestinationId(row);
  if (destination && matchingPlans.has(destination)) return true;
  if (!isReviewDeparture(row)) return false;
  const originPlanId = reviewGroupPlanId(row, origins);
  if (originPlanId && matchingPlans.has(originPlanId)) return true;
  return [reviewOriginName(row), row.sourceStageName, row.sourceStageCode, row.sourceTeacher].some(
    (value) => value && normalizeSearch(value).includes(name),
  );
}

function buildReviewSearch(board: OrganizationBoard, query: string): ReviewSearch {
  const name = normalizeSearch(query.trim());
  const matchingPlans = new Set(
    board.plans
      .filter(
        (plan) =>
          name &&
          [reviewPlanName(plan), plan.stageName, plan.stageCode, plan.teacherName].some(
            (value) => value && normalizeSearch(value).includes(name),
          ),
      )
      .map((plan) => plan.id),
  );
  return { name, matchingPlans, origins: reviewOriginPlans(board.plans) };
}

function filterRiskPlans(board: OrganizationBoard, criteria: ReviewCriteria): Set<string> | null {
  if (!criteria.turmasEmRisco && !criteria.reducaoSignificativa) return null;
  return new Set(
    board.plans
      .filter(
        (plan) =>
          (criteria.turmasEmRisco && atRisk(board, plan)) ||
          (criteria.reducaoSignificativa && significantReduction(board, plan)),
      )
      .map((plan) => plan.id),
  );
}

function classMatchers(
  board: OrganizationBoard,
  criteria: ReviewCriteria,
): {
  matchesStudentClass: (row: Placement) => boolean;
  matchesLeadClass: (lead: WaitingLead) => boolean;
} {
  const plans = new Map(board.plans.map((plan) => [plan.id, plan]));
  function matchesClass(
    teacher: string | null | undefined,
    modality: string | null | undefined,
  ): boolean {
    return (
      (!criteria.professorVinculo || teacher === criteria.professorVinculo) &&
      (!criteria.modalidadeVinculo ||
        (modality && criteria.modalidadeVinculo.split("|").includes(modality)) === true)
    );
  }
  function matchesStudentClass(row: Placement): boolean {
    const plan = isReviewDeparture(row) ? undefined : plans.get(reviewDestinationId(row) ?? "");
    return plan
      ? matchesClass(plan.teacherName, plan.scheduleType)
      : matchesClass(row.sourceTeacher, row.sourceScheduleType);
  }
  function matchesLeadClass(lead: WaitingLead): boolean {
    const plan = plans.get(lead.allocationPlanId ?? "");
    return matchesClass(plan?.teacherName, plan?.scheduleType ?? lead.scheduleType);
  }
  return { matchesStudentClass, matchesLeadClass };
}

function reviewCounts(
  matching: Placement[],
  { leadCount, selectedReasons }: { leadCount: number; selectedReasons: string[] },
): ReviewResults["counts"] {
  const counts: Record<ReviewScope, number> = {
    all: matching.length + leadCount,
    pending: leadCount,
    ready: 0,
    blocked: 0,
    published: 0,
  };
  for (const row of matching) {
    const attention = matchesAttention(row, selectedReasons);
    if (!attention) counts.all--;
    if (row.declinedAt) continue;
    if (matchesReviewScope(row, "published")) {
      counts.published++;
      continue;
    }
    if (attention) counts.pending++;
    if (matchesReviewScope(row, "ready")) counts.ready++;
    if (attention && matchesReviewScope(row, "blocked")) counts.blocked++;
  }
  return counts;
}

export function reviewResults(
  board: OrganizationBoard,
  {
    criteria,
    scope,
    ended = false,
  }: { criteria: ReviewCriteria; scope: ReviewScope; ended?: boolean },
): ReviewResults {
  const search = buildReviewSearch(board, criteria.busca);
  const riskPlans = filterRiskPlans(board, criteria);
  const { matchesStudentClass, matchesLeadClass } = classMatchers(board, criteria);
  const selectedReasons = selectedReviewReasons(criteria.atencaoVinculo);
  const matching = board.placements.filter(
    (row) =>
      (!riskPlans || riskPlans.has(reviewGroupPlanId(row, search.origins) ?? "")) &&
      matchesReviewSearch(row, search) &&
      matchesOriginFilters(row, criteria) &&
      matchesDestinationFilters(row, criteria) &&
      matchesStudentClass(row) &&
      matchesDeparture(row, criteria.saidaVinculo) &&
      (!criteria.precisaTurma || needsReviewDestination(row)),
  );
  const leads = board.waitingLeads.filter((lead) => {
    const allocationPlanId = lead.allocationPlanId ?? "";
    return (
      (!riskPlans || riskPlans.has(allocationPlanId)) &&
      (!ended || Boolean(lead.allocationPlanId)) &&
      (normalizeSearch(lead.fullName).includes(search.name) ||
        search.matchingPlans.has(allocationPlanId)) &&
      matchesLeadClass(lead) &&
      matchesLeadFilters(lead, criteria) &&
      matchesLeadAttention(lead, selectedReasons)
    );
  });
  const visible = matching.filter(
    (row) => !allowsAttention(scope) || matchesAttention(row, selectedReasons),
  );
  return {
    rows: visible.filter((row) => matchesReviewScope(row, scope)),
    leads: scope === "all" || scope === "pending" ? leads : [],
    counts: reviewCounts(matching, { leadCount: leads.length, selectedReasons }),
  };
}
