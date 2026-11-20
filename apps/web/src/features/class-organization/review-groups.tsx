import { useEffect, useRef, useState, type ReactElement, type RefObject } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";
import { ChevronRight, ExternalLink, TriangleAlert } from "lucide-react";
import { Button, Checkbox } from "@lazuli/ui";
import { atRisk, significantReduction } from "./formation-calendar";
import { isReadyForAllocation } from "./confirmation";
import { LeadItem } from "./formation-roster";
import type { ClassPlan, OrganizationBoard, Placement } from "./model";
import { reviewClassHeading } from "./review-class-heading";
import { isReviewDeparture, reviewGroupName, type ReviewGroup } from "./review-group-model";
import { useReviewStudentHref } from "./review-navigation";
import { ReviewRow } from "./review-row";
import { compactSchedule } from "./shared";
import styles from "./review-groups.module.css";

type Props = {
  board: OrganizationBoard;
  groups: ReviewGroup[];
  ended: boolean;
  working: boolean;
  selectedIds: ReadonlySet<string>;
  autoOpenSingle?: boolean;
  onMark: (rows: Placement[], checked: boolean) => void;
  onOpenPlan: (plan: ClassPlan) => void;
  onLead: (id: string) => void;
};

type ReturnFocus = {
  context: string;
  targetId: string;
  groupId: string;
  scrollTop: number;
  offset: number;
};
type ReviewHistory = { lazuliReviewFocus?: ReturnFocus };

// The breadcrumb can create a new history entry. Back restores the marker on the original entry.
let returnFromDetail: ReturnFocus | undefined;

function reviewLocation(semesterId: string): string {
  const params = new URLSearchParams(globalThis.location.search);
  for (const key of ["semestre", "grupoVinculo", "vinculo"]) params.delete(key);
  params.sort();
  return `${semesterId} ${globalThis.location.pathname}?${params.toString()}`;
}

function documentElement(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
}

function rememberFocus(
  semesterId: string,
  { targetId, groupId }: Pick<ReturnFocus, "targetId" | "groupId">,
): void {
  const element = documentElement(targetId);
  const scroller = element?.closest<HTMLElement>("[data-review-groups]");
  if (!element || !scroller) return;
  const focus = {
    context: reviewLocation(semesterId),
    targetId,
    groupId,
    scrollTop: scroller.scrollTop,
    offset: element.getBoundingClientRect().top - scroller.getBoundingClientRect().top,
  };
  returnFromDetail = focus;
  const state = globalThis.history.state as ReviewHistory | null;
  globalThis.history.replaceState({ ...state, lazuliReviewFocus: focus }, "");
}

type FocusRequest = {
  anchor: string | null;
  expandedId: string | null | undefined;
  groupId: string | null;
  groupCount: number;
  semesterId: string;
  studentId: string | null;
};

function takeReviewFocus(semesterId: string): ReturnFocus | undefined {
  const state = globalThis.history.state as ReviewHistory | null;
  const context = reviewLocation(semesterId);
  const saved = [returnFromDetail, state?.lazuliReviewFocus].find(
    (item) => item?.context === context,
  );
  returnFromDetail = undefined;
  return saved;
}

function revealReviewTarget(
  target: HTMLElement,
  {
    list,
    saved,
    original,
  }: {
    list: HTMLDivElement | null;
    saved: ReturnFocus | undefined;
    original: HTMLElement | null;
  },
): void {
  if (list && saved && original) {
    const desiredOffset = Math.min(
      Math.max(0, saved.offset),
      Math.max(0, list.clientHeight - original.offsetHeight),
    );
    list.scrollTop +=
      original.getBoundingClientRect().top - list.getBoundingClientRect().top - desiredOffset;
    return;
  }
  if (list && saved) list.scrollTop = saved.scrollTop;
  target.scrollIntoView({ block: "nearest" });
}

function reviewFocusTarget(
  original: HTMLElement | null,
  { anchor, groupId }: Pick<FocusRequest, "anchor" | "groupId">,
): HTMLElement | null {
  return (
    original ??
    (anchor ? documentElement(anchor) : null) ??
    (groupId ? documentElement(`review-group-${groupId}`) : null) ??
    documentElement("formation-page-heading")
  );
}

function canRestoreFocus(target: HTMLElement): boolean {
  const active = document.activeElement;
  return (
    !active ||
    active === document.body ||
    active === target ||
    active.id === "formation-page-heading"
  );
}

function restoreReviewFocus({
  saved,
  anchor,
  groupId,
  list,
}: Pick<FocusRequest, "anchor" | "groupId"> & {
  saved: ReturnFocus | undefined;
  list: HTMLDivElement | null;
}): void {
  const original = saved ? documentElement(saved.targetId) : null;
  const target = reviewFocusTarget(original, { anchor, groupId: saved?.groupId ?? groupId });
  if (!target || !canRestoreFocus(target)) return;
  const control = target.matches("li") ? target.querySelector<HTMLElement>("button") : target;
  control?.focus({ preventScroll: true });
  revealReviewTarget(target, { list, saved, original });
}

function useReviewGroupFocus({
  anchor,
  expandedId,
  groupId,
  groupCount,
  semesterId,
  studentId,
}: FocusRequest): { scroller: RefObject<HTMLDivElement | null>; toggledHere: RefObject<boolean> } {
  const toggledHere = useRef(false);
  const onArrival = useRef(true);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (toggledHere.current) {
      toggledHere.current = false;
      return;
    }
    const frame = requestAnimationFrame(() => {
      const saved = onArrival.current ? takeReviewFocus(semesterId) : undefined;
      onArrival.current = false;
      if (saved || studentId || groupId)
        restoreReviewFocus({ saved, anchor, groupId, list: scroller.current });
    });
    return () => cancelAnimationFrame(frame);
  }, [anchor, expandedId, groupId, semesterId, studentId, groupCount]);
  return { scroller, toggledHere };
}

function reviewGroupAnchor(student: string | null, group: string | undefined): string | null {
  if (student) return `review-student-${student}`;
  return group ? `review-group-${group}` : null;
}

function defaultReviewGroup(groups: ReviewGroup[], autoOpenSingle?: boolean): string | undefined {
  if (autoOpenSingle && groups.length === 1) return groups[0]?.id;
  return undefined;
}

function useExpandedReviewGroups({
  groups,
  autoOpenSingle,
  semesterId,
}: Pick<Props, "groups" | "autoOpenSingle"> & { semesterId: string }): {
  scroller: RefObject<HTMLDivElement | null>;
  isExpanded: (id: string) => boolean;
  toggleGroup: (id: string) => void;
} {
  const [groupId, setGroupId] = useQueryState("grupoVinculo");
  const [openGroups, setOpenGroups] = useQueryState(
    "turmasAbertas",
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [studentId, setStudentId] = useQueryState("vinculo");
  const [collapsedGroup, setCollapsedGroup] = useState<string | null>(null);
  const linkedGroup = studentId
    ? groups.find((group) => group.rows.some((row) => row.id === studentId))
    : undefined;
  const namedGroup = groups.find((group) => group.id === groupId);
  const singleGroup = defaultReviewGroup(groups, autoOpenSingle);
  const expandedId =
    linkedGroup?.id ?? namedGroup?.id ?? (singleGroup === collapsedGroup ? null : singleGroup);
  const anchor = reviewGroupAnchor(linkedGroup ? studentId : null, namedGroup?.id);
  const { scroller, toggledHere } = useReviewGroupFocus({
    anchor,
    expandedId,
    groupId,
    groupCount: groups.length,
    semesterId,
    studentId,
  });

  function toggleGroup(id: string): void {
    toggledHere.current = true;
    void setStudentId(null);
    const next = new Set(openGroups);
    if (expandedId) next.add(expandedId);
    const closing = next.has(id);
    if (closing) next.delete(id);
    else next.add(id);
    setCollapsedGroup(closing && singleGroup === id ? id : null);
    void setOpenGroups([...next]);
    void setGroupId(closing ? null : id);
  }
  const isExpanded = (id: string): boolean => id === expandedId || openGroups.includes(id);
  return { scroller, isExpanded, toggleGroup };
}

function useOriginHref(semesterId: string): (group: ReviewGroup) => string | undefined {
  const pathname = usePathname();
  const params = useSearchParams();
  return (group): string | undefined => {
    if (!group.origin?.classId) return undefined;
    const back = new URLSearchParams(params.toString());
    back.set("visao", "review");
    back.set("semestre", semesterId);
    back.set("grupoVinculo", group.id);
    back.delete("vinculo");
    const query = new URLSearchParams({ voltar: `${pathname}?${back.toString()}` });
    return `/turmas/${encodeURIComponent(group.origin.classId)}?${query.toString()}`;
  };
}

export function ReviewGroups(props: Props): ReactElement | null {
  const semesterId = props.board.semester.id;
  const studentHref = useReviewStudentHref(semesterId);
  const originHref = useOriginHref(semesterId);
  const { scroller, isExpanded, toggleGroup } = useExpandedReviewGroups({
    groups: props.groups,
    autoOpenSingle: props.autoOpenSingle === true,
    semesterId,
  });
  if (props.groups.length === 0) return null;
  return (
    <div
      ref={scroller}
      className={styles.groups}
      aria-label="Vínculos por turma de destino ou de origem"
      role="region"
      data-review-groups=""
      inert={props.working}
    >
      {props.groups.map((group) => (
        <ReviewGroupSection
          key={group.id}
          group={group}
          board={props.board}
          ended={props.ended}
          working={props.working}
          selectedIds={props.selectedIds}
          expanded={isExpanded(group.id)}
          studentHref={studentHref}
          originHref={originHref(group)}
          onToggle={() => toggleGroup(group.id)}
          onMark={props.onMark}
          onOpenPlan={props.onOpenPlan}
          onLead={props.onLead}
        />
      ))}
    </div>
  );
}

type SectionProps = Omit<Props, "groups" | "autoOpenSingle"> & {
  group: ReviewGroup;
  expanded: boolean;
  studentHref: (rowId: string, groupId: string) => string;
  originHref: string | undefined;
  onToggle: () => void;
};

function ReviewGroupSection(props: SectionProps): ReactElement {
  const { group, ended, expanded } = props;
  const { id, kind, rows } = group;
  const canMark = kind === "plan" && rows.length > 0 && !ended;
  const ready = canMark
    ? rows.filter(
        (row) => row.planId === id && !isReviewDeparture(row) && isReadyForAllocation(row),
      )
    : [];
  const name = reviewGroupName(group);
  return (
    <section className={styles.group} data-open={expanded || undefined}>
      <header className={styles.groupHeader}>
        <div className={styles.groupSummary}>
          <ReviewGroupHeading {...props} name={name} />
          <MemberCounts
            id={`review-context-${id}-counts`}
            group={group}
            noReady={canMark && ready.length === 0}
          />
        </div>
        {ready.length > 0 && <ReviewGroupSelection {...props} name={name} ready={ready} />}
      </header>
      {expanded && <ReviewGroupMembers {...props} name={name} ready={ready} />}
    </section>
  );
}

type GroupHeadingProps = Pick<
  SectionProps,
  "board" | "group" | "expanded" | "originHref" | "onToggle" | "onOpenPlan"
> & { name: string };

function reviewHeadingLabels(
  group: ReviewGroup,
  name: string,
): ReturnType<typeof reviewClassHeading> & {
  tooltip: string | undefined;
  labelledBy: string;
  scheduleType: string | null | undefined;
} {
  const { id, plan, origin } = group;
  const heading: ReturnType<typeof reviewClassHeading> = headingForGroup(group, name) ?? {
    title: name,
    description: "",
  };
  const contextId = `review-context-${id}`;
  return {
    ...heading,
    tooltip: plan || origin?.classId ? name : undefined,
    scheduleType: plan?.scheduleType ?? origin?.scheduleType,
    labelledBy: [
      `${contextId}-name`,
      heading.schedule && `${contextId}-schedule`,
      heading.description && `${contextId}-meta`,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function ReviewGroupHeading(props: GroupHeadingProps): ReactElement {
  const { group, board, name, expanded, onToggle } = props;
  const { id, plan } = group;
  const { schedule, title, description, labelledBy, tooltip, scheduleType } = reviewHeadingLabels(
    group,
    name,
  );
  const contextId = `review-context-${id}`;
  return (
    <div className={styles.groupIdentity} data-schedule={scheduleType}>
      <div className={styles.classTitle}>
        <div className={styles.headingActions}>
          <h2 className={styles.groupHeading}>
            <button
              id={`review-group-${id}`}
              type="button"
              className={styles.groupToggle}
              title={tooltip}
              aria-labelledby={labelledBy}
              aria-describedby={`${contextId}-counts`}
              aria-expanded={expanded}
              aria-controls={expanded ? `review-members-${id}` : undefined}
              onClick={onToggle}
            >
              <ChevronRight aria-hidden="true" size={17} className={styles.groupChevron} />
              <strong id={`${contextId}-name`}>{title}</strong>
            </button>
          </h2>
          <GroupSheetLink {...props} />
        </div>
        {schedule && (
          <span id={`${contextId}-schedule`} className={styles.classTime}>
            {schedule}
          </span>
        )}
        {plan && <GroupRisk board={board} plan={plan} />}
      </div>
      {description && (
        <span id={`${contextId}-meta`} className={styles.groupMeta}>
          {description}
        </span>
      )}
    </div>
  );
}

function GroupRisk({
  board,
  plan,
}: {
  board: OrganizationBoard;
  plan: ClassPlan;
}): ReactElement | null {
  const risk = atRisk(board, plan);
  if (!risk && !significantReduction(board, plan)) return null;
  return (
    <span className={styles.risk}>
      <TriangleAlert size={14} aria-hidden="true" />{" "}
      {risk ? "Turma em risco" : "Redução significativa"}
    </span>
  );
}

function GroupSheetLink({
  group,
  board,
  name,
  originHref,
  onOpenPlan,
}: GroupHeadingProps): ReactElement | null {
  const { id, plan } = group;
  if (!plan && !originHref) return null;
  const label = `Ver ficha da turma ${name}`;
  const targetId = `review-plan-${id}`;
  const rememberPlan = (): void => rememberFocus(board.semester.id, { targetId, groupId: id });
  const buttonProps = plan
    ? {
        onClick: () => {
          rememberPlan();
          onOpenPlan(plan);
        },
      }
    : {
        nativeButton: false,
        render: <Link href={originHref!} prefetch={false} onNavigate={rememberPlan} />,
      };
  return (
    <Button
      {...buttonProps}
      id={targetId}
      data-review-plan-link=""
      size="icon-compact-responsive"
      variant="text"
      aria-label={label}
      title={label}
    >
      <ExternalLink aria-hidden="true" />
    </Button>
  );
}

function ReviewGroupSelection({
  group,
  name,
  ready,
  selectedIds,
  working,
  onMark,
}: Pick<SectionProps, "group" | "selectedIds" | "working" | "onMark"> & {
  name: string;
  ready: Placement[];
}): ReactElement {
  const marked = ready.filter((row) => selectedIds.has(row.id)).length;
  const checkboxId = `review-select-group-${group.id}`;
  const label = `Selecionar ${ready.length} ${ready.length === 1 ? "aluno" : "alunos"}`;
  return (
    <label
      className={styles.groupSelection}
      htmlFor={checkboxId}
      data-disabled={working || undefined}
    >
      <Checkbox
        id={checkboxId}
        size="md"
        checked={marked === ready.length}
        indeterminate={marked > 0 && marked < ready.length}
        disabled={working}
        aria-labelledby={`${checkboxId}-label`}
        aria-describedby={marked ? `${checkboxId}-marked` : undefined}
        onCheckedChange={(value) => onMark(ready, Boolean(value))}
      />
      <span id={`${checkboxId}-label`} className="sr-only">
        {label} de {name} neste filtro
      </span>
      <span aria-hidden="true">{label}</span>
      {marked > 0 && (
        <strong id={`${checkboxId}-marked`} className={styles.marked}>
          {marked} no lote
        </strong>
      )}
    </label>
  );
}

function ReviewGroupMembers({
  group,
  board,
  ended,
  working,
  selectedIds,
  studentHref,
  onMark,
  onLead,
  name,
  ready,
}: SectionProps & { name: string; ready: Placement[] }): ReactElement {
  const { id, plan, rows, leads } = group;
  return (
    <div className={styles.groupBody} id={`review-members-${id}`}>
      <ul className={styles.students} aria-label={`Pessoas em ${name}`}>
        {rows.map((row) => (
          <ReviewRow
            key={row.id}
            row={row}
            board={board}
            plan={plan}
            ended={ended}
            eligible={ready.includes(row)}
            working={working}
            selected={selectedIds.has(row.id)}
            href={studentHref(row.id, id)}
            onNavigate={() =>
              rememberFocus(board.semester.id, {
                targetId: `review-student-${row.id}`,
                groupId: id,
              })
            }
            onSelection={(person, checked) => onMark([person], checked)}
          />
        ))}
        {leads.map((lead) => (
          <li key={lead.id} id={`review-lead-${lead.id}`} className={styles.lead}>
            <LeadItem
              lead={lead}
              onSelect={(person) => {
                rememberFocus(board.semester.id, {
                  targetId: `review-lead-${person.id}`,
                  groupId: id,
                });
                onLead(person.id);
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function headingForGroup(
  group: ReviewGroup,
  name: string,
): ReturnType<typeof reviewClassHeading> | undefined {
  if (group.kind === "plan") return reviewClassHeading(group.plan, name);
  if (group.kind !== "origin" || !group.origin.classId) return undefined;
  const { scheduleType, schedule, teacherName } = group.origin;
  if (!scheduleType)
    return {
      title: name,
      description: ["Turma de origem", compactSchedule(schedule, "long"), teacherName]
        .filter(Boolean)
        .join(" · "),
    };
  const row = group.rows[0];
  const heading = reviewClassHeading(
    {
      scheduleType,
      slots: schedule,
      teacherName,
      stageName: row?.sourceStageName ?? null,
      stageCode: row?.sourceStageCode ?? null,
    },
    name,
  );
  return {
    ...heading,
    description: ["Turma de origem", heading.description].filter(Boolean).join(" · "),
  };
}

function MemberCounts({
  id,
  group,
  noReady,
}: {
  id: string;
  group: ReviewGroup;
  noReady: boolean;
}): ReactElement {
  const { rows, leads } = group;
  const students = `${rows.length} ${rows.length === 1 ? "aluno" : "alunos"}`;
  const members = [
    rows.length > 0 && students,
    leads.length > 0 && `${leads.length} ${leads.length === 1 ? "lead" : "leads"}`,
  ];
  return (
    <span className={styles.members} id={id}>
      <span>{members.filter(Boolean).join(" · ")}</span>
      {noReady && <span>Nenhum vínculo a confirmar</span>}
    </span>
  );
}
