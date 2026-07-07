import {
  attendanceConfirmSessionInputSchema,
  attendanceSessionRosterInputSchema,
} from "@lazuli/validators";

import { router, staffProcedure } from "../trpc/init.js";
import { confirmSession } from "./confirm.js";
import { readSessionRoster } from "./roster.js";

export const attendanceRouter = router({
  sessionRoster: staffProcedure
    .input(attendanceSessionRosterInputSchema)
    .query(({ ctx, input }) =>
      readSessionRoster({ database: ctx.db, staffUser: ctx.staffUser, sessionId: input.sessionId }),
    ),
  confirmSession: staffProcedure
    .input(attendanceConfirmSessionInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        confirmSession({ database, staffUser: ctx.staffUser, values: input }),
      ),
    ),
});
