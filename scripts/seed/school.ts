import type { DatabaseClient } from "../../packages/db/src/client.js";
import { seedCourseCatalog } from "../../packages/db/src/seed-course-catalog.js";
import { seedDevData } from "../../packages/db/src/seed-dev.js";
import { DEV_CLASSES, DEV_STUDENTS, DEV_TEACHERS } from "../../packages/db/src/seed-dev-data.js";
import {
  resolvePersonalizedPortalClassName,
  resolveRegularPortalClassName,
} from "../../packages/api/src/classes/portal-name.js";
import { seedSettings } from "./settings.js";
import { seedContracts } from "./contracts.js";

/** Shared by initial provisioning and the destructive pnpm seed entry point. */
export async function seedSchool(database: DatabaseClient, todayIso: string): Promise<void> {
  await seedCourseCatalog(database);
  await seedDevData(database, {
    todayIso,
    resolveClassName: (classSeed, semester) => {
      const input = {
        database,
        slots: classSeed.slots,
        semesterName: semester.name,
        year: semester.year,
      };
      return classSeed.scheduleType === "PERSONALIZED"
        ? resolvePersonalizedPortalClassName(input)
        : resolveRegularPortalClassName({
            ...input,
            stageInternalCode: classSeed.stageInternalCode,
          });
    },
  });
  await seedSettings(database);
  await seedContracts(database, todayIso);
  process.stdout.write(
    `School loaded for ${todayIso}: ${DEV_STUDENTS.length} students, ${DEV_CLASSES.length} classes and ${DEV_TEACHERS.length} teachers.\n`,
  );
}
