import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classArchiveInputSchema,
  classCloneForNextPeriodInputSchema,
  classCreateInputSchema,
  classFormatSchema,
  classGenerateSessionsInputSchema,
  classScheduleSlotInputSchema,
  classScheduleTypeSchema,
  timeOfDaySchema,
  weekdaySchema,
} from "../src/class.js";

const CLASS_ID = "11111111-1111-4111-8111-111111111111";
const TEACHER_ID = "22222222-2222-4222-8222-222222222222";
const STAGE_ID = "33333333-3333-4333-8333-333333333333";
const SEMESTER_ID = "44444444-4444-4444-8444-444444444444";

const REGULAR_CLASS_INPUT = {
  internalCode: " GRE-29 ",
  teacherId: TEACHER_ID,
  scheduleType: "REGULAR",
  format: "IN_PERSON",
  sharedStageId: STAGE_ID,
  semesterId: SEMESTER_ID,
  year: 2026,
  capacity: 12,
  slots: [{ weekday: "TUESDAY", startTime: "14:00", endTime: "16:00" }],
};

void describe("class schedule input", () => {
  void it("accepts a valid regular class and trims staff-visible text", () => {
    const parsed = classCreateInputSchema.parse({
      ...REGULAR_CLASS_INPUT,
      slots: [
        ...REGULAR_CLASS_INPUT.slots,
        { weekday: "THURSDAY", startTime: "08:00", endTime: "09:00" },
      ],
    });

    assert.equal(parsed.internalCode, "GRE-29");
    assert.equal(parsed.sharedStageId, STAGE_ID);
    assert.equal(parsed.portalClassName, undefined);
    assert.equal(parsed.slots.length, 2);
  });

  void it("accepts HH:mm slots only when the end time is after the start time", () => {
    const trimmedTime = timeOfDaySchema.parse(" 09:30 ");
    const validSlot = classScheduleSlotInputSchema.parse({
      weekday: "MONDAY",
      startTime: "08:30",
      endTime: "09:15",
    });
    const equalTime = classScheduleSlotInputSchema.safeParse({
      weekday: "MONDAY",
      startTime: "09:00",
      endTime: "09:00",
    });

    assert.equal(trimmedTime, "09:30");
    assert.equal(validSlot.endTime, "09:15");
    assert.equal(timeOfDaySchema.safeParse("24:00").success, false);
    assert.equal(timeOfDaySchema.safeParse("x09:30").success, false);
    assert.equal(timeOfDaySchema.safeParse("09:30x").success, false);
    assert.equal(
      equalTime.error?.issues[0]?.message,
      "Horario de inicio deve ser anterior ao horario de termino.",
    );
    assert.deepEqual(equalTime.error?.issues[0]?.path, ["endTime"]);
  });
});

void describe("regular class placement input", () => {
  void it("requires regular classes to use shared catalog placement", () => {
    const result = classCreateInputSchema.safeParse({
      ...REGULAR_CLASS_INPUT,
      sharedStageId: undefined,
      semesterId: undefined,
      portalClassName: "Manual",
    });

    assert.deepEqual(
      result.error?.issues.map((issue) => issue.path.join(".")),
      ["portalClassName", "sharedStageId", "semesterId"],
    );
  });

  void it("treats null shared stage and semester values as missing for regular classes", () => {
    const result = classCreateInputSchema.safeParse({
      ...REGULAR_CLASS_INPUT,
      sharedStageId: null,
      semesterId: null,
    });

    assert.deepEqual(
      result.error?.issues.map((issue) => issue.path.join(".")),
      ["sharedStageId", "semesterId"],
    );
  });
});

void describe("personalized class placement input", () => {
  void it("accepts personalized classes with manual names and no shared stage", () => {
    const parsed = classCreateInputSchema.parse({
      ...REGULAR_CLASS_INPUT,
      scheduleType: "PERSONALIZED",
      format: "ONLINE",
      sharedStageId: null,
      portalClassName: "VIP Ana",
    });
    const omittedStage = classCreateInputSchema.parse({
      ...REGULAR_CLASS_INPUT,
      scheduleType: "PERSONALIZED",
      format: "ONLINE",
      sharedStageId: undefined,
      portalClassName: "VIP Bruno",
    });

    assert.equal(parsed.scheduleType, "PERSONALIZED");
    assert.equal(parsed.sharedStageId, null);
    assert.equal(parsed.portalClassName, "VIP Ana");
    assert.equal(omittedStage.sharedStageId, undefined);
  });

  void it("requires personalized classes to use a manual Portal name and no shared stage", () => {
    const result = classCreateInputSchema.safeParse({
      ...REGULAR_CLASS_INPUT,
      scheduleType: "PERSONALIZED",
      format: "ONLINE",
      sharedStageId: STAGE_ID,
      semesterId: undefined,
      portalClassName: undefined,
    });

    assert.deepEqual(
      result.error?.issues.map((issue) => issue.path.join(".")),
      ["sharedStageId", "portalClassName", "semesterId"],
    );
  });

  void it("treats a null semester value as missing for personalized classes", () => {
    const result = classCreateInputSchema.safeParse({
      ...REGULAR_CLASS_INPUT,
      scheduleType: "PERSONALIZED",
      format: "ONLINE",
      sharedStageId: null,
      semesterId: null,
      portalClassName: "VIP Ana",
    });

    assert.deepEqual(
      result.error?.issues.map((issue) => issue.path.join(".")),
      ["semesterId"],
    );
  });
});

void describe("class enum input", () => {
  void it("keeps every weekday, class format, and schedule type literal available", () => {
    assert.equal(weekdaySchema.safeParse("MONDAY").success, true);
    assert.equal(weekdaySchema.safeParse("TUESDAY").success, true);
    assert.equal(weekdaySchema.safeParse("WEDNESDAY").success, true);
    assert.equal(weekdaySchema.safeParse("THURSDAY").success, true);
    assert.equal(weekdaySchema.safeParse("FRIDAY").success, true);
    assert.equal(weekdaySchema.safeParse("SATURDAY").success, true);
    assert.equal(weekdaySchema.safeParse("SUNDAY").success, true);
    assert.equal(weekdaySchema.safeParse("HOLIDAY").success, false);
    assert.equal(classFormatSchema.safeParse("IN_PERSON").success, true);
    assert.equal(classFormatSchema.safeParse("ONLINE").success, true);
    assert.equal(classScheduleTypeSchema.safeParse("REGULAR").success, true);
    assert.equal(classScheduleTypeSchema.safeParse("PERSONALIZED").success, true);
  });
});

void describe("class command input", () => {
  void it("accepts exactly one generation scope", () => {
    const classScoped = classGenerateSessionsInputSchema.parse({ classId: CLASS_ID });
    const semesterScoped = classGenerateSessionsInputSchema.parse({ semesterId: SEMESTER_ID });

    assert.equal(classScoped.classId, CLASS_ID);
    assert.equal(semesterScoped.semesterId, SEMESTER_ID);
    assert.equal(classGenerateSessionsInputSchema.safeParse({}).success, false);
    assert.equal(
      classGenerateSessionsInputSchema.safeParse({
        classId: CLASS_ID,
        semesterId: SEMESTER_ID,
      }).success,
      false,
    );
  });

  void it("validates clone and archive identifiers at the schema boundary", () => {
    const clone = classCloneForNextPeriodInputSchema.parse({
      id: CLASS_ID,
      internalCode: " GRE-30 ",
      semesterId: SEMESTER_ID,
      year: 2099,
      sharedStageId: STAGE_ID,
    });

    assert.equal(clone.internalCode, "GRE-30");
    assert.equal(classArchiveInputSchema.safeParse({ id: CLASS_ID }).success, true);
    assert.equal(classArchiveInputSchema.safeParse({ id: "not-a-uuid" }).success, false);
    assert.equal(
      classCloneForNextPeriodInputSchema.safeParse({
        id: CLASS_ID,
        internalCode: "GRE-30",
        semesterId: SEMESTER_ID,
        year: 1999,
      }).success,
      false,
    );
  });
});
