import type { JSX as ReactJSX } from "react";
import { InlineSkeleton } from "@lazuli/ui";
import styles from "./workspace.module.css";

export function TeacherListLoading({
  label,
  kind = "records",
  status = false,
}: {
  label: string;
  kind?: "classes" | "students" | "records" | "links";
  status?: boolean;
}): ReactJSX.Element {
  const grouped = kind === "classes" || kind === "students";
  return (
    <div role="status" aria-label={label} aria-busy="true" className={styles.groups}>
      <span className="sr-only">{label}…</span>
      {Array.from({ length: kind === "students" ? 2 : 1 }, (_, group) => (
        <div className={styles.group} key={group} aria-hidden="true">
          {grouped && (
            <div className={styles.groupHeader}>
              <InlineSkeleton className="h-3 w-32 rounded-sm" />
              <InlineSkeleton className="h-3 w-12 rounded-sm" />
            </div>
          )}
          <ul className={styles.list}>
            {[0, 1, 2].map((row) => (
              <li key={row}>
                <div className={kind === "records" ? "flex items-center gap-3 p-4" : styles.row}>
                  {kind === "students" && <InlineSkeleton className="size-8" />}
                  <div className={`${styles.rowIdentity} grid gap-2`}>
                    <InlineSkeleton
                      className={`${row % 2 ? "w-36" : "w-44"} h-3.5 max-w-full rounded-sm`}
                    />
                    <InlineSkeleton className="h-3 w-28 max-w-full rounded-sm" />
                    {kind === "classes" && (
                      <InlineSkeleton className="h-2.5 w-36 max-w-full rounded-sm" />
                    )}
                  </div>
                  <InlineSkeleton
                    className={status ? "h-5 w-16 rounded-sm" : "size-3 rounded-sm"}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
