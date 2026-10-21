type ReviewRow = {
  enrollmentId: string;
  status: "PRESENT" | "ABSENT";
  reviewed: boolean;
  manuallyReviewed: boolean;
};
/** A QR opened during editing must not turn untouched default rows into confirmed presence. */
export function applyQrReview<Row extends ReviewRow>(rows: Row[], declared: string[]): Row[] {
  return rows.map((row) => {
    if (row.manuallyReviewed) return row;
    const received = declared.includes(row.enrollmentId);
    return { ...row, status: received ? "PRESENT" : "ABSENT", reviewed: received };
  });
}
