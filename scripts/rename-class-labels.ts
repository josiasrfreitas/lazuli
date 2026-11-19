/** Backfill stored class labels using the same formatter as creation. Pass --apply to persist. */
import { randomUUID } from "node:crypto";
import { db, type TransactionClient } from "../packages/db/src/client.js";
import { responsibilitySelect, usualTeacherOn } from "../packages/db/src/teacher-responsibility.js";
import {
  generatePortalClassName,
  type ClassNameInput,
} from "../packages/domain/src/class-portal-name.js";
import { saoPauloDateOnly } from "../packages/domain/src/session-time.js";
import { readSlots } from "../packages/api/src/semester-organization/data.js";
import { databaseSlotToCandidate } from "../packages/api/src/teachers/availability.js";

const apply = process.argv.includes("--apply");
const today = new Date(saoPauloDateOnly(new Date()));

function availableName(details: ClassNameInput, occupied: Set<string>): string {
  let sequence = 1;
  let name = generatePortalClassName(details);
  while (occupied.has(name)) name = generatePortalClassName(details, ++sequence);
  occupied.add(name);
  return name;
}

async function collectLabels(tx: TransactionClient) {
  const classes = await tx.class.findMany({
    select: {
      ...responsibilitySelect,
      id: true,
      status: true,
      scheduleType: true,
      portalClassName: true,
      sharedStage: { select: { internalCode: true } },
      semester: { select: { startDate: true, endDate: true } },
      scheduleSlots: {
        where: { deletedAt: null },
        select: { weekday: true, startTime: true, endTime: true },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const unscheduledClasses = classes.filter((row) => row.scheduleSlots.length === 0);
  const occupied = new Set(
    unscheduledClasses.filter((row) => row.status === "ACTIVE").map((row) => row.portalClassName),
  );
  const classNames = new Map<string, string>();
  const changedClasses = [];
  for (const row of classes) {
    if (row.scheduleSlots.length === 0) {
      classNames.set(row.id, row.portalClassName);
      continue;
    }
    const date = new Date(
      Math.min(
        row.semester.endDate.getTime(),
        Math.max(today.getTime(), row.semester.startDate.getTime()),
      ),
    );
    const details = {
      scheduleType: row.scheduleType,
      stageInternalCode: row.sharedStage?.internalCode,
      slots: row.scheduleSlots.map(databaseSlotToCandidate),
      teacherName: usualTeacherOn(row, date)?.name,
    };
    const name =
      row.status === "ACTIVE" ? availableName(details, occupied) : generatePortalClassName(details);
    classNames.set(row.id, name);
    if (row.portalClassName !== name) changedClasses.push({ id: row.id, name });
  }
  const plans = await tx.semesterClassPlan.findMany({
    select: {
      id: true,
      classId: true,
      name: true,
      scheduleType: true,
      slots: true,
      sharedStage: { select: { internalCode: true } },
      teacher: { select: { name: true } },
    },
  });
  const changedPlans = [];
  let unscheduledPlans = 0;
  for (const plan of plans) {
    const slots = readSlots(plan.slots);
    if (!slots.length) unscheduledPlans++;
    const className = plan.classId ? classNames.get(plan.classId) : undefined;
    if (!className && !slots.length) continue;
    const name =
      className ??
      generatePortalClassName({
        scheduleType: plan.scheduleType,
        slots,
        stageInternalCode: plan.sharedStage?.internalCode,
        teacherName: plan.teacher?.name,
      });
    if (plan.name !== name) changedPlans.push({ id: plan.id, name });
  }
  return {
    changedClasses,
    changedPlans,
    classes: classes.length,
    plans: plans.length,
    unscheduledClasses: unscheduledClasses.length,
    unscheduledPlans,
  };
}

try {
  const result = await db.$transaction(
    async (tx) => {
      if (apply)
        await tx.$executeRaw`LOCK TABLE "Class", "SemesterClassPlan" IN SHARE ROW EXCLUSIVE MODE`;
      const { changedClasses, changedPlans, ...summary } = await collectLabels(tx);
      if (apply) {
        // Vacate old labels first so two classes can exchange unique names atomically.
        const prefix = randomUUID();
        for (const row of changedClasses)
          await tx.class.update({
            where: { id: row.id },
            data: { portalClassName: prefix + row.id },
          });
        for (const row of changedClasses)
          await tx.class.update({ where: { id: row.id }, data: { portalClassName: row.name } });
        for (const row of changedPlans)
          await tx.semesterClassPlan.update({
            where: { id: row.id },
            data: { name: row.name, version: { increment: 1 } },
          });
      }
      return {
        apply,
        ...summary,
        changedClasses: changedClasses.length,
        changedPlans: changedPlans.length,
      };
    },
    { isolationLevel: "Serializable", maxWait: 60_000, timeout: 60_000 },
  );
  console.log(result);
} finally {
  await db.$disconnect();
}
