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
  absenceContactSchema,
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
} from "./read.js";
import { listAbsences } from "./absences.js";
import { recordAbsenceContact } from "./contacts.js";

export const appointmentsRouter = router({
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
        input.studentId,
        input.excludeAppointmentId,
      ),
    ),
  destinations: adminProcedure
    .input(z.object({ date: civilDateSchema }).strict())
    .query(({ ctx, input }) =>
      appointmentDestinations(
        { database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
        input.date,
      ),
    ),
  absences: adminProcedure
    .input(absenceListSchema)
    .query(({ ctx, input }) =>
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
            input,
          ),
        { timeout: 15000 },
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
        { timeout: 15000 },
      ),
    ),
  cancel: adminProcedure
    .input(appointmentCancelSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        cancelAppointment(
          { database, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
          input,
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
        { timeout: 15000 },
      ),
    ),
  contact: adminProcedure
    .input(absenceContactSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        recordAbsenceContact(
          { database, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
          input,
        ),
      ),
    ),
});
