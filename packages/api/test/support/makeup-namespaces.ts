import { createHarness, defineNamespace } from "./attendance-test-support.js";

// One isolated namespace per makeup test file (parallel-safe): distinct prefix, catalog key, user ids,
// and a non-overlapping past Semester window — disjoint from the attendance suites (2011/2013/2015).
export const scheduleHarness = createHarness(
  defineNamespace({
    label: "mkschedule",
    startDate: "2017-02-01",
    endDate: "2017-06-30",
    sessionDate: "2017-03-10",
    afterSessionDate: "2017-04-01",
    adminId: "00000000-0000-0000-0000-000000350001",
    teacherId: "00000000-0000-0000-0000-000000350002",
    otherTeacherId: "00000000-0000-0000-0000-000000350003",
  }),
);

export const cancelHarness = createHarness(
  defineNamespace({
    label: "mkcancel",
    startDate: "2019-02-01",
    endDate: "2019-06-30",
    sessionDate: "2019-03-10",
    afterSessionDate: "2019-04-01",
    adminId: "00000000-0000-0000-0000-000000350011",
    teacherId: "00000000-0000-0000-0000-000000350012",
    otherTeacherId: "00000000-0000-0000-0000-000000350013",
  }),
);

export const outcomeHarness = createHarness(
  defineNamespace({
    label: "mkoutcome",
    startDate: "2021-02-01",
    endDate: "2021-06-30",
    sessionDate: "2021-03-10",
    afterSessionDate: "2021-04-01",
    adminId: "00000000-0000-0000-0000-000000350021",
    teacherId: "00000000-0000-0000-0000-000000350022",
    otherTeacherId: "00000000-0000-0000-0000-000000350023",
  }),
);

export const visitorHarness = createHarness(
  defineNamespace({
    label: "mkvisitor",
    startDate: "2023-02-01",
    endDate: "2023-06-30",
    sessionDate: "2023-03-10",
    afterSessionDate: "2023-04-01",
    adminId: "00000000-0000-0000-0000-000000350031",
    teacherId: "00000000-0000-0000-0000-000000350032",
    otherTeacherId: "00000000-0000-0000-0000-000000350033",
  }),
);
