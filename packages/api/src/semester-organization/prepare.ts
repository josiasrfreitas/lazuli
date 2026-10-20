import { saoPauloDateOnly } from "@lazuli/domain";
import {
  lockSemester,
  dateOnly,
  readSlots,
  recordPlacementRevision,
  type OrganizationContext,
} from "./data.js";
import { recordActivity } from "../activity/record.js";

/** Copy only missing records. Repeating this command never overwrites the coordinator's edits. */
export async function prepareSemester(context: OrganizationContext, semesterId: string) {
  const semester = await lockSemester(context, semesterId);
  const today = saoPauloDateOnly(context.now);
  const current = dateOnly(semester.startDate) <= today;
  const source = current
    ? semester
    : await context.database.semester.findFirst({
        where: { deletedAt: null, startDate: { lt: semester.startDate } },
        orderBy: { startDate: "desc" },
      });
  if (!source) return { plans: 0, students: 0 };
  const classes = await context.database.class.findMany({
    where: { semesterId: source.id, deletedAt: null, status: "ACTIVE" },
    include: {
      scheduleSlots: { where: { deletedAt: null } },
      teacherAssignments: {
        where: { deletedAt: null, supersededAt: null, effectiveDate: { lte: new Date(today) } },
        orderBy: { effectiveDate: "desc" },
        take: 1,
      },
      enrollments: {
        where: {
          deletedAt: null,
          OR: [{ exitDate: null }, { exitDate: { gt: new Date(today) } }],
          entryDate: { lte: new Date(today) },
          student: { deletedAt: null, status: "ACTIVE" },
        },
        include: {
          progressRecords: {
            where: {
              deletedAt: null,
              startDate: { lte: new Date(today) },
              OR: [{ endDate: null }, { endDate: { gte: new Date(today) } }],
            },
            include: { stage: true },
          },
        },
      },
    },
    orderBy: { portalClassName: "asc" },
  });
  let plans = 0;
  let students = 0;
  for (const group of classes) {
    const slots = group.scheduleSlots.map((slot) => ({
      weekday: slot.weekday,
      startTime: slot.startTime.toISOString().slice(11, 16),
      endTime: slot.endTime.toISOString().slice(11, 16),
    }));
    if (!slots.length) continue;
    let plan = await context.database.semesterClassPlan.findFirst({
      where: {
        semesterId,
        deletedAt: null,
        OR: [
          { sourceClassId: group.id },
          { classId: group.id },
          { placements: { some: { deletedAt: null, sourceEnrollment: { classId: group.id } } } },
        ],
      },
    });
    if (!plan) {
      plan = await context.database.semesterClassPlan.create({
        data: {
          semesterId,
          sourceClassId: group.id,
          classId: current ? group.id : null,
          name: group.portalClassName,
          scheduleType: group.scheduleType,
          format: group.format,
          sharedStageId: group.sharedStageId,
          teacherId: group.teacherAssignments[0]?.teacherId ?? group.teacherId,
          slots,
          recordedById: context.staffUser.id,
        },
      });
      plans++;
    }
    for (const enrollment of group.enrollments) {
      for (const progress of enrollment.progressRecords) {
        const exists = await context.database.semesterPlacement.findFirst({
          where: {
            semesterId,
            studentId: enrollment.studentId,
            trackId: progress.stage.trackId,
            deletedAt: null,
          },
        });
        if (exists) continue;
        const previousPlacement = current
          ? null
          : await context.database.semesterPlacement.findFirst({
              where: {
                semesterId: source.id,
                studentId: enrollment.studentId,
                trackId: progress.stage.trackId,
                deletedAt: null,
              },
            });
        const availability = await context.database.studentAvailability.findFirst({
          where: { semesterId, studentId: enrollment.studentId, deletedAt: null },
          orderBy: { createdAt: "desc" },
        });
        if (!availability) {
          const previous = await context.database.studentAvailability.findFirst({
            where: { studentId: enrollment.studentId, confirmed: true, deletedAt: null },
            orderBy: { createdAt: "desc" },
          });
          await context.database.studentAvailability.create({
            data: {
              semesterId,
              studentId: enrollment.studentId,
              validUntil: semester.endDate,
              formats: previous?.formats ?? [group.format],
              slots: previous ? readSlots(previous.slots) : slots,
              notes:
                previous?.notes ??
                "Horário herdado da turma de origem; revise se o combinado mudou.",
              recordedById: context.staffUser.id,
            },
          });
        }
        const row = await context.database.semesterPlacement.create({
          data: {
            semesterId,
            planId: previousPlacement?.continuity === "CHANGE" ? null : plan.id,
            continuity: previousPlacement?.continuity ?? "UNDECIDED",
            continuityReason: previousPlacement?.continuityReason ?? null,
            studentId: enrollment.studentId,
            trackId: progress.stage.trackId,
            stageId: progress.stageId,
            sourceProgressId: progress.id,
            sourceEnrollmentId: enrollment.id,
            mode: "CONTINUE",
            effectiveDate: current ? enrollment.entryDate : semester.startDate,
            recordedById: context.staffUser.id,
            ...(current
              ? {
                  publishedAt: context.now,
                  publishedById: context.staffUser.id,
                  enrollmentId: enrollment.id,
                }
              : {}),
          },
        });
        await recordPlacementRevision(context, row.id, "INHERITED");
        students++;
      }
    }
  }
  if (!current) {
    const waiting = await context.database.semesterPlacement.findMany({
      where: {
        semesterId: source.id,
        deletedAt: null,
        declinedAt: null,
        publishedAt: null,
      },
    });
    for (const previous of waiting) {
      if (
        await context.database.semesterPlacement.findFirst({
          where: {
            semesterId,
            studentId: previous.studentId,
            trackId: previous.trackId,
            deletedAt: null,
          },
        })
      )
        continue;
      const row = await context.database.semesterPlacement.create({
        data: {
          semesterId,
          studentId: previous.studentId,
          trackId: previous.trackId,
          stageId: previous.stageId,
          sourceProgressId: previous.sourceProgressId,
          sourceEnrollmentId: previous.sourceEnrollmentId,
          mode: previous.mode,
          notes: previous.notes,
          effectiveDate: semester.startDate,
          continuity: previous.continuity,
          continuityReason: previous.continuityReason,
          recordedById: context.staffUser.id,
        },
      });
      await recordPlacementRevision(context, row.id, "CARRIED_FORWARD");
      students++;
    }
    const previousAvailability = await context.database.studentAvailability.findMany({
      where: {
        semesterId: source.id,
        deletedAt: null,
        student: {
          deletedAt: null,
          status: "ACTIVE",
          OR: [
            { semesterPlacements: { none: { semesterId: source.id, deletedAt: null } } },
            {
              semesterPlacements: {
                some: {
                  semesterId: source.id,
                  deletedAt: null,
                  publishedAt: null,
                  declinedAt: null,
                },
              },
            },
          ],
        },
      },
      distinct: ["studentId"],
      orderBy: { createdAt: "desc" },
    });
    for (const previous of previousAvailability) {
      if (
        await context.database.studentAvailability.findFirst({
          where: { semesterId, studentId: previous.studentId, deletedAt: null },
        })
      )
        continue;
      await context.database.studentAvailability.create({
        data: {
          semesterId,
          studentId: previous.studentId,
          validUntil: semester.endDate,
          formats: previous.formats,
          slots: readSlots(previous.slots),
          confirmed: false,
          notes: previous.notes,
          recordedById: context.staffUser.id,
        },
      });
    }
  }
  if (plans || students)
    await recordActivity(context.database, context, "semesterOrganization.prepare", {
      subject: { type: "school", name: semester.name },
      description: `${plans} turma(s) e ${students} aluno(s) incorporados. Alterações anteriores preservadas.`,
    });
  return { plans, students };
}
