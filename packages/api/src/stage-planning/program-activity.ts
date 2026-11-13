import { badRequest } from "../trpc/errors.js";
import type { PlanningContext, PlanningScope } from "./data.js";

/** Bind a dated intention to the source activity without changing the imported curriculum. */
export async function resolvePlannedProgramActivity(
  context: PlanningContext,
  { scope, id, previousId }: { scope: PlanningScope; id: string; previousId: string | null },
): Promise<{
  kind: "CONTENT" | "ASSESSMENT" | "REVIEW" | "ACTIVITY";
  title: string;
  reference: string;
}> {
  const activity = await context.database.programActivity.findFirst({
    where: {
      id,
      deletedAt: null,
      teachingHour: {
        deletedAt: null,
        program: {
          stageId: scope.stage.id,
          scheduleType: scope.class.scheduleType,
          deletedAt: null,
          ...(id === previousId ? {} : { retiredAt: null }),
        },
      },
    },
    include: {
      unit: { select: { sequence: true } },
      teachingHour: { select: { sequence: true } },
    },
  });
  if (!activity)
    throw badRequest("Atividade indisponível para o estágio e a programação deste plano.");
  const kind = programActivityKind(activity.kind);
  return {
    kind,
    title: activity.title,
    reference: `Unidade ${activity.unit.sequence} · hora-aula ${activity.teachingHour.sequence}`,
  };
}

export function programActivityKind(
  kind: string,
): "CONTENT" | "ASSESSMENT" | "REVIEW" | "ACTIVITY" {
  switch (kind) {
    case "LESSON": {
      return "CONTENT";
    }
    case "ASSESSMENT": {
      return "ASSESSMENT";
    }
    case "REVIEW": {
      return "REVIEW";
    }
    default: {
      return "ACTIVITY";
    }
  }
}
