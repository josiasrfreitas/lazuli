import { router } from "../trpc/init.js";
import { academicCalendarRouter } from "./academic.js";
/** Calendar writes share a preview/confirmation boundary; no alternate unreviewed mutations. */
export const calendarRouter = router({ academic: academicCalendarRouter });
