import { saveEmployee } from "./save.js";
import { saoPauloDateOnly } from "@lazuli/domain";
import { searchIds } from "../search.js";
import {
  employeeFields,
  teacherIdInputSchema,
  teacherListInputSchema,
  z,
} from "@lazuli/validators";
import { adminProcedure, router } from "../trpc/init.js";
import { badRequest } from "../trpc/errors.js";
import { activityTransaction } from "../activity/record.js";
import { readEmployee } from "./read.js";

export const employeesRouter = router({
  byId: adminProcedure
    .input(teacherIdInputSchema)
    .query(({ ctx, input }) => readEmployee(ctx.db, input.id)),
  list: adminProcedure
    .input(
      teacherListInputSchema.pick({ search: true, page: true, pageSize: true }).extend({
        areas: employeeFields.shape.area.array().optional(),
        hasTeacherProfile: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        deletedAt: null,
        employeeProfile: {
          is: { deletedAt: null, ...(input.areas?.length && { area: { in: input.areas } }) },
        },
        ...(input.hasTeacherProfile !== undefined && {
          teacherProfile: input.hasTeacherProfile
            ? { is: { deletedAt: null } }
            : { isNot: { deletedAt: null } },
        }),
        id: (await searchIds(ctx.db, { table: "User", query: input.search })) ?? {},
      };
      const total = await ctx.db.user.count({ where });
      const pageCount = Math.max(1, Math.ceil(total / input.pageSize));
      const page = Math.min(pageCount, input.page);
      const rows = await ctx.db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          employeeProfile: { select: { area: true, jobTitle: true } },
          teacherProfile: { select: { deletedAt: true, departureDate: true } },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: (page - 1) * input.pageSize,
        take: input.pageSize,
      });
      return {
        rows,
        total,
        pageCount,
        page,
        pageSize: input.pageSize,
        today: saoPauloDateOnly(ctx.now ?? new Date()),
      };
    }),
  save: adminProcedure
    .input(employeeFields.extend({ id: z.string().uuid().optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await activityTransaction(ctx, {
          action: input.id ? "employees.update" : "employees.create",
          work: (tx) => saveEmployee(tx, { input, actor: ctx.staffUser }),
          describe: (result) => ({
            subject: { type: "employee", id: result.id, name: result.name },
          }),
        });
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "P2002")
          throw badRequest("CPF ou e-mail já cadastrado.");
        throw error;
      }
    }),
});
