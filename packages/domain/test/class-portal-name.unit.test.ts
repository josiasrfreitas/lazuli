import assert from "node:assert/strict";
import { it } from "node:test";
import { generatePortalClassName, type ClassNameInput } from "../src/class-portal-name.js";

const regular: ClassNameInput = {
  scheduleType: "REGULAR",
  stageInternalCode: "MWR",
  teacherName: "Rafael Mendes",
  slots: [
    { weekday: "THURSDAY", startTime: "14:00", endTime: "15:30" },
    { weekday: "TUESDAY", startTime: "14:00", endTime: "15:30" },
  ],
};

void it("groups meeting days with the same hours in calendar order", () => {
  assert.equal(generatePortalClassName(regular), "REG MWR TER/QUI/14:00-15:30 Rafael Mendes");
});

void it("retains different end times and multiple meetings on the same day", () => {
  const name = generatePortalClassName({
    scheduleType: "PERSONALIZED",
    slots: [
      { weekday: "SUNDAY", startTime: "09:00", endTime: "11:00" },
      { weekday: "SATURDAY", startTime: "14:00", endTime: "15:00" },
      { weekday: "MONDAY", startTime: "09:00", endTime: "10:00" },
      { weekday: "SATURDAY", startTime: "09:00", endTime: "11:00" },
    ],
  });
  assert.equal(name, "PPT SEG/09:00-10:00 + SÁB/DOM/09:00-11:00 + SÁB/14:00-15:00");
});

void it("omits an inapplicable stage and a missing teacher without leaving separators", () => {
  assert.equal(
    generatePortalClassName({ ...regular, scheduleType: "PERSONALIZED", teacherName: null }),
    "PPT TER/QUI/14:00-15:30",
  );
});

void it("includes the whole teacher at the length limit and makes room for a collision suffix", () => {
  const base = "REG MWR TER/QUI/14:00-15:30";
  const teacher = "Á".repeat(80 - base.length - 1);
  assert.equal(generatePortalClassName({ ...regular, teacherName: teacher }), base + " " + teacher);
  assert.equal(generatePortalClassName({ ...regular, teacherName: teacher }, 2), base + " · 2");
  assert.equal(generatePortalClassName({ ...regular, teacherName: teacher + "x" }), base);
});

void it("keeps all required meeting times even when their combined label exceeds the teacher budget", () => {
  const slots = [
    { weekday: "MONDAY", startTime: "07:00", endTime: "08:00" },
    { weekday: "TUESDAY", startTime: "09:00", endTime: "10:00" },
    { weekday: "WEDNESDAY", startTime: "11:00", endTime: "12:00" },
    { weekday: "THURSDAY", startTime: "13:00", endTime: "14:00" },
    { weekday: "FRIDAY", startTime: "15:00", endTime: "16:00" },
  ] as const;
  assert.equal(
    generatePortalClassName({ ...regular, slots }),
    "REG MWR SEG/07:00-08:00 + TER/09:00-10:00 + QUA/11:00-12:00 + QUI/13:00-14:00 + SEX/15:00-16:00",
  );
});
