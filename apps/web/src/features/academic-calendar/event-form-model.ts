import { formatDateOnlyBR } from "~/lib/format";
import type { AcademicYear } from "./model";
import type { EventDraft } from "./event-fields";
const SCHOOL_OFFSET_MS = 10_800_000;
const DATE_END = 10;
const TIME_START = 11;
const TIME_END = 16;
const localInput = (value: Date): string =>
  new Date(value.getTime() - SCHOOL_OFFSET_MS).toISOString().slice(0, TIME_END);
function initialDateValue(value: Date | undefined, initialDate: string | undefined): string {
  if (value) return formatDateOnlyBR(localInput(value).slice(0, DATE_END));
  return initialDate ? formatDateOnlyBR(initialDate) : "";
}
export function initialEventDraft({
  item,
  initialDate,
}: {
  item?: AcademicYear["events"][number] | undefined;
  initialDate?: string | undefined;
}): EventDraft {
  return {
    title: item?.title ?? "",
    description: item?.description ?? "",
    startDate: initialDateValue(item?.startsAt, initialDate),
    startTime: item ? localInput(item.startsAt).slice(TIME_START, TIME_END) : "",
    endDate: initialDateValue(item?.endsAt, initialDate),
    endTime: item ? localInput(item.endsAt).slice(TIME_START, TIME_END) : "",
  };
}
