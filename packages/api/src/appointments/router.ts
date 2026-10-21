import {
  z,
  civilDateSchema,
  appointmentIdSchema,
  appointmentScheduleSchema,
  appointmentCancelSchema,
  appointmentRescheduleSchema,
  appointmentRecordSchema,
  appointmentListSchema,
  appointmentStudentSchema,
  absenceListSchema,
} from "@lazuli/validators";
import { adminProcedure, router, staffProcedure } from "../trpc/init.js";
import { scheduleAppointment } from "./schedule.js";
import { recordAppointment } from "./record.js";
import { cancelAppointment, rescheduleAppointment } from "./actions.js";
import {
  appointmentDestinations,
  appointmentDetail,
  appointmentStudentOptions,
  listAppointments,
  studentAppointments,
} from "./read.js";
import { appointmentAvailability } from "./availability.js";
import { listAbsences } from "./absences.js";

const MILLISECONDS_PER_DAY = 86_400_000;

export const appointmentsRouter = router({
  forStudent: staffProcedure
    .input(z.object({ studentId: z.string().uuid() }).strict())
    .query(({ ctx, input }) =>
      studentAppointments(
        { database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
        input.studentId,
      ),
    ),
  list: staffProcedure
    .input(appointmentListSchema)
    .query(({ ctx, input }) =>
      listAppointments(
        { database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
        input,
      ),
    ),
  detail: staffProcedure
    .input(appointmentIdSchema)
    .query(({ ctx, input }) =>
      appointmentDetail(
        { database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
        input.id,
      ),
    ),
  student: adminProcedure
    .input(appointmentStudentSchema)
    .query(({ ctx, input }) =>
      appointmentStudentOptions(
        { database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
        { studentId: input.studentId, excludeAppointmentId: input.excludeAppointmentId },
      ),
    ),
  availability: adminProcedure
    .input(
      z
        .object({
          teacherId: z.string().uuid(),
          studentId: z.string().uuid(),
          week: civilDateSchema,
          through: civilDateSchema.optional(),
          excludeAppointmentId: z.string().uuid().optional(),
        })
        .strict()
        .refine(
          ({ week, through }) =>
            !through ||
            (through >= week && Date.parse(through) - Date.parse(week) <= 6 * 24 * 60 * 60 * 1000),
          {
            path: ["through"],
            message: "Escolha um período de até sete dias a partir da data inicial.",
          },
        ),
    )
    .query(({ ctx, input }) =>
      appointmentAvailability(
        { database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
        input,
      ),
    ),
  destinations: adminProcedure
    .input(
      z
        .object({ date: civilDateSchema, through: civilDateSchema.optional() })
        .strict()
        .refine(
          ({ date, through }) =>
            !through ||
            (through >= date &&
              new Date(through).getTime() - new Date(date).getTime() <= 6 * MILLISECONDS_PER_DAY),
          { message: "Consulte até uma semana de aulas." },
        ),
    )
    .query(({ ctx, input }) =>
      appointmentDestinations(
        { database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
        { date: input.date, through: input.through },
      ),
    ),
  absences: adminProcedure.input(absenceListSchema).query(({ ctx, input }) =>
    ctx.db.$transaction((database) => listAbsences(database, input), {
      isolationLevel: "RepeatableRead",
    }),
  ),
  schedule: adminProcedure
    .input(appointmentScheduleSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(
        (database) =>
          scheduleAppointment(
            { database, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
            { input },
          ),
        { timeout: 15_000 },
      ),
    ),
  record: staffProcedure
    .input(appointmentRecordSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(
        (database) =>
          recordAppointment(
            { database, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
            input,
          ),
        { timeout: 15_000 },
      ),
    ),
  cancel: adminProcedure
    .input(appointmentCancelSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        cancelAppointment(
          { database, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
          { input },
        ),
      ),
    ),
  reschedule: adminProcedure
    .input(appointmentRescheduleSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(
        (database) =>
          rescheduleAppointment(
            { database, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
            input,
          ),
        { timeout: 15_000 },
      ),
    ),
});
