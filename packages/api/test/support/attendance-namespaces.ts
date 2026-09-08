import { createHarness, defineNamespace } from "./attendance-test-support.js";

// One isolated namespace per test file (parallel-safe): distinct prefix, catalog key, user ids, and a
// non-overlapping past Semester window.
export const rosterHarness = createHarness(
  defineNamespace({
    label: "roster",
    startDate: "2011-02-01",
    endDate: "2011-06-30",
    sessionDate: "2011-03-10",
    afterSessionDate: "2011-04-01",
    adminId: "00000000-0000-0000-0000-000000611001",
    teacherId: "00000000-0000-0000-0000-000000611002",
    otherTeacherId: "00000000-0000-0000-0000-000000611003",
  }),
);

export const confirmHarness = createHarness(
  defineNamespace({
    label: "confirm",
    startDate: "2013-02-01",
    endDate: "2013-06-30",
    sessionDate: "2013-03-10",
    afterSessionDate: "2013-04-01",
    adminId: "00000000-0000-0000-0000-000000612001",
    teacherId: "00000000-0000-0000-0000-000000612002",
    otherTeacherId: "00000000-0000-0000-0000-000000612003",
  }),
);

export const editHarness = createHarness(
  defineNamespace({
    label: "edit",
    startDate: "2014-02-01",
    endDate: "2014-06-30",
    sessionDate: "2014-03-10",
    afterSessionDate: "2014-04-01",
    adminId: "00000000-0000-0000-0000-000000614001",
    teacherId: "00000000-0000-0000-0000-000000614002",
    otherTeacherId: "00000000-0000-0000-0000-000000614003",
  }),
);

export const percentHarness = createHarness(
  defineNamespace({
    label: "percent",
    startDate: "3000-02-01",
    endDate: "3000-06-30",
    sessionDate: "3000-03-10",
    afterSessionDate: "3000-04-01",
    adminId: "00000000-0000-0000-0000-000000615001",
    teacherId: "00000000-0000-0000-0000-000000615002",
    otherTeacherId: "00000000-0000-0000-0000-000000615003",
  }),
);

export const behaviorHarness = createHarness(
  defineNamespace({
    label: "behavior",
    startDate: "2015-02-01",
    endDate: "2015-06-30",
    sessionDate: "2015-03-10",
    afterSessionDate: "2015-04-01",
    adminId: "00000000-0000-0000-0000-000000613001",
    teacherId: "00000000-0000-0000-0000-000000613002",
    otherTeacherId: "00000000-0000-0000-0000-000000613003",
  }),
);
