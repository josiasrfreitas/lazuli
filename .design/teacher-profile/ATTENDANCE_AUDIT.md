# Attendance compensation audit

2026-11-12. Requested scope: retain the teacher's raw absence percentage and identify other
places where completed makeup attendance reduces absence-related indicators. This audit does not
authorize changing the student/domain rules below.

## Shared rule

[`attendanceProgressFromTotals`](../../packages/domain/src/compensated-attendance.ts) currently
calculates attendance as `(presentMinutes + compensatedMinutes) / heldMinutes`, missing minutes
as `heldMinutes - presentMinutes - compensatedMinutes`, and the low-attendance flag from that
adjusted percentage (<75%). Original ABSENT records and presence counts are not rewritten.
Only completed, source-linked makeup coverage is credited, capped at each absent session's duration.

## Affected consumers

| Surface                                    | Current effect                                                                                                                                                  | Source                                                                                                                                                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student profile, enrollment attendance     | Percentage includes makeup minutes; “min ausentes” excludes credited minutes; the 75% warning uses this percentage.                                             | [pedagogy.ts](../../packages/api/src/students/pedagogy.ts), [enrollment-attendance.tsx](../../apps/web/src/features/students/profile/enrollment-attendance.tsx)                                                                 |
| Student directory and preview              | Attendance percentage and flagged state come from the same compensated calculation.                                                                             | [students/list.ts](../../packages/api/src/students/list.ts)                                                                                                                                                                     |
| Class student roster                       | The Frequência column uses the compensated enrollment percentage.                                                                                               | [classes/read.ts](../../packages/api/src/classes/read.ts)                                                                                                                                                                       |
| Student attendance-history dialog          | Summary percentage includes makeup credit, while the original absence count and row status remain unchanged.                                                    | [attendance-history.ts](../../packages/api/src/students/attendance-history.ts), [attendance-history-dialog.tsx](../../apps/web/src/features/students/profile/attendance-history-dialog.tsx)                                     |
| Student health score, individual and batch | Makeup minutes enter the attendance component. This also propagates to student health displayed on class/teacher pages and to the teacher's mean student score. | [student-health.ts](../../packages/db/src/student-health.ts), [student-health-batch-attendance.ts](../../packages/db/src/student-health-batch-attendance.ts), [teachers/metrics.ts](../../packages/api/src/teachers/metrics.ts) |
| Enrollment-semester attendance endpoint    | Returns the shared compensated percentage and flags to its consumers.                                                                                           | [attendance/percent.ts](../../packages/api/src/attendance/percent.ts), [db/attendance-percent.ts](../../packages/db/src/attendance-percent.ts)                                                                                  |

## Teacher page adjustment

The primary teacher absence percentage was already `absentMinutes / heldMinutes`, without makeup
deductions. It remains unchanged, as do the raw percentages in class and student cards.
Removed the secondary “Faltas não compensadas” reading and detail column from the teacher page.

The API still returns the unused `remainingPercent` field from
[teachers/metric-rules.ts](../../packages/api/src/teachers/metric-rules.ts), which subtracts
`compensatedMinutes`. It was inventoried rather than changing the shared data contract during this UI task.
The teacher health information dialog still accurately describes the existing compensated student score.

The appointment's available makeup balance also subtracts completed coverage in
[appointments/absences.ts](../../packages/api/src/appointments/absences.ts). That prevents duplicate
coverage allocation; it is not itself an attendance-percentage calculation.

## Change boundary

No student health/frequency formula, recorded attendance, appointment coverage or historical record
was changed by this audit. Adopting raw attendance throughout would require updating the shared rule,
the direct health aggregation, their callers/copy and the corresponding contract tests together.
