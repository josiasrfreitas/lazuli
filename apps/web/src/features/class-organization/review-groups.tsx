import { useEffect, useRef, useState, type ReactElement } from "react";
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
type ReviewHistory = Record<string, unknown> & { lazuliReviewFocus?: ReturnFocus };

// The breadcrumb can create a new history entry. Back restores the marker on the original entry.
let returnFromDetail: ReturnFocus | undefined;

function reviewLocation(semesterId: string): string {
  const params = new URLSearchParams(window.location.search);
  for (const key of ["semestre", "grupoVinculo", "vinculo"]) params.delete(key);
  params.sort();
  return `${semesterId} ${window.location.pathname}?${params.toString()}`;
}

function rememberFocus(semesterId: string, targetId: string, groupId: string): void {
  const element = document.getElementById(targetId);
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
  const state = window.history.state as ReviewHistory | null;
  window.history.replaceState({ ...state, lazuliReviewFocus: focus }, "");
}

export function ReviewGroups(props: Props): ReactElement | null {
  const [groupId, setGroupId] = useQueryState("grupoVinculo");
  const [openGroups, setOpenGroups] = useQueryState(
    "turmasAbertas",
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [studentId, setStudentId] = useQueryState("vinculo");
  const semesterId = props.board.semester.id;
  const studentHref = useReviewStudentHref(semesterId);
  const pathname = usePathname();
  const params = useSearchParams();
  const [collapsedGroup, setCollapsedGroup] = useState<string | null>(null);
  const toggledHere = useRef(false);
  const onArrival = useRef(true);
  const scroller = useRef<HTMLDivElement>(null);
  const linkedGroup = studentId
    ? props.groups.find((group) => group.rows.some((row) => row.id === studentId))
    : undefined;
  const namedGroup = props.groups.find((group) => group.id === groupId);
  const singleGroup =
    props.autoOpenSingle && props.groups.length === 1 ? props.groups[0] : undefined;
  const expandedId =
    linkedGroup?.id ??
    namedGroup?.id ??
    (singleGroup?.id === collapsedGroup ? null : singleGroup?.id);
  const anchor = linkedGroup
    ? `review-student-${studentId}`
    : namedGroup
      ? `review-group-${namedGroup.id}`
      : null;
  useEffect(() => {
    if (toggledHere.current) {
      toggledHere.current = false;
      return;
    }
    const frame = requestAnimationFrame(() => {
      let saved: ReturnFocus | undefined;
      if (onArrival.current) {
        const state = window.history.state as ReviewHistory | null;
        const context = reviewLocation(semesterId);
        saved = [returnFromDetail, state?.lazuliReviewFocus].find(
          (item) => item?.context === context,
        );
        returnFromDetail = undefined;
        onArrival.current = false;
      }
      if (!saved && !studentId && !groupId) return;
      const original = saved ? document.getElementById(saved.targetId) : null;
      const group = saved?.groupId ?? groupId;
      const target =
        original ??
        (anchor ? document.getElementById(anchor) : null) ??
        (group ? document.getElementById(`review-group-${group}`) : null) ??
        document.getElementById("formation-page-heading");
      const active = document.activeElement;
      if (
        !target ||
        (active &&
          active !== document.body &&
          active !== target &&
          active.id !== "formation-page-heading")
      )
        return;
      const control = target.matches("li") ? target.querySelector<HTMLElement>("button") : target;
      control?.focus({ preventScroll: true });
      const list = scroller.current;
      if (list && saved && original) {
        const desiredOffset = Math.min(
          Math.max(0, saved.offset),
          Math.max(0, list.clientHeight - original.offsetHeight),
        );
        list.scrollTop +=
          original.getBoundingClientRect().top - list.getBoundingClientRect().top - desiredOffset;
      } else {
        if (list && saved) list.scrollTop = saved.scrollTop;
        target.scrollIntoView({ block: "nearest" });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [anchor, expandedId, groupId, semesterId, studentId, props.groups.length]);

  function toggleGroup(id: string): void {
    toggledHere.current = true;
    void setStudentId(null);
    const next = new Set(openGroups);
    if (expandedId) next.add(expandedId);
    const closing = next.has(id);
    if (closing) next.delete(id);
    else next.add(id);
    setCollapsedGroup(closing && singleGroup?.id === id ? id : null);
    void setOpenGroups([...next]);
    void setGroupId(closing ? null : id);
  }
  function originHref(group: ReviewGroup): string | undefined {
    if (!group.origin?.classId) return undefined;
    const back = new URLSearchParams(params.toString());
    back.set("visao", "review");
    back.set("semestre", semesterId);
    back.set("grupoVinculo", group.id);
    back.delete("vinculo");
    const query = new URLSearchParams({ voltar: `${pathname}?${back.toString()}` });
    return `/turmas/${encodeURIComponent(group.origin.classId)}?${query.toString()}`;
  }
  if (!props.groups.length) return null;
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
          expanded={group.id === expandedId || openGroups.includes(group.id)}
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

function ReviewGroupSection({
  group,
  board,
  ended,
  working,
  selectedIds,
  expanded,
  studentHref,
  originHref,
  onToggle,
  onMark,
  onOpenPlan,
  onLead,
}: SectionProps): ReactElement {
  const { id, kind, plan, origin, rows, leads } = group;
  const canMark = kind === "plan" && rows.length > 0 && !ended;
  const ready = canMark
    ? rows.filter(
        (row) => row.planId === id && !isReviewDeparture(row) && isReadyForAllocation(row),
      )
    : [];
  const marked = ready.filter((row) => selectedIds.has(row.id)).length;
  const name = reviewGroupName(group);
  const heading = headingForGroup(group, name);
  const groupId = `review-members-${id}`;
  const checkboxId = `review-select-group-${id}`;
  const planLabel = `Ver ficha da turma ${name}`;
  const planFocusId = `review-plan-${id}`;
  const rememberPlan = () => rememberFocus(board.semester.id, planFocusId, id);
  const sheetControl = plan
    ? {
        onClick: () => {
          rememberPlan();
          onOpenPlan(plan);
        },
      }
    : originHref
      ? {
          nativeButton: false,
          render: <Link href={originHref} prefetch={false} onNavigate={rememberPlan} />,
        }
      : null;
  const contextId = `review-context-${id}`;
  const labelledBy = [
    `${contextId}-name`,
    heading?.schedule && `${contextId}-schedule`,
    heading?.description && `${contextId}-meta`,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <section className={styles.group} data-open={expanded || undefined}>
      <header className={styles.groupHeader}>
        <div className={styles.groupSummary}>
          <div
            className={styles.groupIdentity}
            data-schedule={plan?.scheduleType ?? origin?.scheduleType}
          >
            <div className={styles.classTitle}>
              <div className={styles.headingActions}>
                <h2 className={styles.groupHeading}>
                  <button
                    id={`review-group-${id}`}
                    type="button"
                    className={styles.groupToggle}
                    title={plan || origin?.classId ? name : undefined}
                    aria-labelledby={labelledBy}
                    aria-describedby={`${contextId}-counts`}
                    aria-expanded={expanded}
                    aria-controls={expanded ? groupId : undefined}
                    onClick={onToggle}
                  >
                    <ChevronRight aria-hidden="true" size={17} className={styles.groupChevron} />
                    <strong id={`${contextId}-name`}>{heading?.title ?? name}</strong>
                  </button>
                </h2>
                {sheetControl && (
                  <Button
                    {...sheetControl}
                    id={planFocusId}
                    className={styles.planLink}
                    size="icon-compact-responsive"
                    variant="text"
                    aria-label={planLabel}
                    title={planLabel}
                  >
                    <ExternalLink aria-hidden="true" />
                  </Button>
                )}
              </div>
              {heading?.schedule && (
                <span id={`${contextId}-schedule`} className={styles.classTime}>
                  {heading.schedule}
                </span>
              )}
              {plan && atRisk(board, plan) && (
                <span className={styles.risk}>
                  <TriangleAlert size={14} aria-hidden="true" /> Turma em risco
                </span>
              )}
              {plan && significantReduction(board, plan) && (
                <span className={styles.risk}>
                  <TriangleAlert size={14} aria-hidden="true" /> Redução significativa
                </span>
              )}
            </div>
            {heading?.description && (
              <span id={`${contextId}-meta`} className={styles.groupMeta}>
                {heading.description}
              </span>
            )}
          </div>
          <MemberCounts
            id={`${contextId}-counts`}
            group={group}
            noReady={canMark && !ready.length}
          />
        </div>
        {ready.length > 0 && (
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
              Selecionar {ready.length} {ready.length === 1 ? "aluno" : "alunos"} de {name} neste
              filtro
            </span>
            <span aria-hidden="true">
              Selecionar {ready.length} {ready.length === 1 ? "aluno" : "alunos"}
            </span>
            {marked > 0 && (
              <strong id={`${checkboxId}-marked`} className={styles.marked}>
                {marked} no lote
              </strong>
            )}
          </label>
        )}
      </header>
      {expanded && (
        <div className={styles.groupBody} id={groupId}>
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
                onNavigate={() => rememberFocus(board.semester.id, `review-student-${row.id}`, id)}
                onSelection={(person, checked) => onMark([person], checked)}
              />
            ))}
            {leads.map((lead) => (
              <li key={lead.id} id={`review-lead-${lead.id}`} className={styles.lead}>
                <LeadItem
                  lead={lead}
                  onSelect={(person) => {
                    rememberFocus(board.semester.id, `review-lead-${person.id}`, id);
                    onLead(person.id);
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
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
