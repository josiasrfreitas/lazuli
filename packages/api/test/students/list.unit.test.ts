import assert from "node:assert/strict";
import { it } from "node:test";

import { createCaller, type Context } from "@lazuli/api";

import { ADMIN_FIXTURE } from "../support/support.js";

const STUDENT_ID = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-09-24T12:00:00.000Z");
const DATE_ONLY = new Date("2026-02-01T00:00:00.000Z");
const FIRST_SLOT_TIME = new Date("1970-01-01T08:30:00.000Z");
const REGULAR_SLOT_TIME = new Date("1970-01-01T09:00:00.000Z");

void it("renders the full weekly class schedule in the student row", async () => {
  const database = Object.assign({} as Context["db"], {
    student: {
      findMany: () =>
        Promise.resolve([
          {
            id: STUDENT_ID,
            fullName: "Ana Schedule",
            status: "ACTIVE",
            phone: null,
            birthDate: new Date("1980-01-01T00:00:00.000Z"),
            enrollments: [
              {
                id: "00000000-0000-4000-8000-000000000011",
                classId: "00000000-0000-4000-8000-000000000021",
                entryDate: DATE_ONLY,
                exitDate: null,
                class: {
                  internalCode: "ENG-1",
                  teacher: { name: "Professora Ana" },
                  scheduleSlots: [
                    { weekday: "MONDAY", startTime: FIRST_SLOT_TIME },
                    { weekday: "TUESDAY", startTime: REGULAR_SLOT_TIME },
                    { weekday: "WEDNESDAY", startTime: REGULAR_SLOT_TIME },
                    { weekday: "THURSDAY", startTime: REGULAR_SLOT_TIME },
                    { weekday: "FRIDAY", startTime: REGULAR_SLOT_TIME },
                    { weekday: "SATURDAY", startTime: REGULAR_SLOT_TIME },
                    { weekday: "SUNDAY", startTime: REGULAR_SLOT_TIME },
                  ],
                },
              },
            ],
          },
        ]),
      count: () => Promise.resolve(1),
    },
    semester: { findMany: () => Promise.resolve([]) },
    financeSettings: { findUnique: () => Promise.resolve(null) },
    orderBeneficiary: { findMany: () => Promise.resolve([]) },
  });

  const result = await createCaller({
    db: database,
    now: NOW,
    staffUser: ADMIN_FIXTURE,
  }).students.list({});

  assert.equal(
    result.rows[0]?.enrollment?.scheduleLabel,
    "Seg, Ter, Qua, Qui, Sex, Sáb e Dom · 08:30",
  );
});
