import assert from "node:assert/strict";
import { it } from "node:test";
import { generatePortalClassName, type ClassNameInput } from "../src/class-portal-name.js";

const wednesday = { weekday: "WEDNESDAY", startTime: "19:00", endTime: "20:00" } as const;
const monday = { ...wednesday, weekday: "MONDAY" } as const;
const regular: ClassNameInput = {
  scheduleType: "REGULAR",
  format: "IN_PERSON",
  trackName: "Teens Connect",
  stageInternalCode: "C1",
  teacherName: "Iago Santos",
  slots: [wednesday],
};

void it("formats book codes, online delivery and single or grouped days", () => {
  assert.equal(generatePortalClassName(regular), "TC1-QUA-19");
  assert.equal(
    generatePortalClassName({ ...regular, slots: [wednesday, monday] }),
    "TC1-SEG/QUA-19:00",
  );
  assert.equal(generatePortalClassName({ ...regular, format: "ONLINE" }), "TC1/ON-QUA-19:00");
  assert.equal(generatePortalClassName({ ...regular, trackName: "Outro" }), "C1-QUA-19");
});

void it("uses the first name for in-person PPT and ON for online PPT", () => {
  const ppt = { ...regular, scheduleType: "PERSONALIZED", slots: [monday] } as const;
  assert.equal(generatePortalClassName(ppt), "PPT/IAGO-SEG-19:00");
  const saturday = { weekday: "SATURDAY", startTime: "08:00", endTime: "09:00" } as const;
  assert.equal(
    generatePortalClassName({ ...ppt, format: "ONLINE", slots: [saturday] }),
    "PPT/ON-SAB-08:00",
  );
  assert.equal(
    generatePortalClassName({
      ...ppt,
      teacherName: " Mauren Souza ",
      slots: [{ ...saturday, startTime: "10:00", endTime: "11:00" }],
    }),
    "PPT/MAUREN-SAB-10:00",
  );
  assert.equal(generatePortalClassName({ ...ppt, teacherName: null }), "PPT-SEG-19:00");
});

void it("groups by start, preserves minutes, and only adds a suffix for collisions", () => {
  const slots = [
    wednesday,
    { ...monday, endTime: "20:30" },
    { ...wednesday, startTime: "20:15", endTime: "21:15" },
  ];
  assert.equal(
    generatePortalClassName({ ...regular, slots }, 2),
    "TC1-SEG/QUA-19:00+QUA-20:15 · 2",
  );
  assert.equal(generatePortalClassName({ ...regular, slots: [slots[2]!] }), "TC1-QUA-20:15");
  assert.equal(generatePortalClassName({ ...regular, slots: [] }), "TC1");
});
