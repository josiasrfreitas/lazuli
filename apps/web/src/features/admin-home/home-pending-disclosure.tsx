import { useId, useState, type ReactElement, type ReactNode } from "react";
import styles from "./home-pending.module.css";

/** One interruptible reveal for every pending-work group. */
export function PendingDisclosure({
  summary,
  children,
  onOpenChange,
  action,
}: {
  action?: ReactNode;
  summary: ReactNode;
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={styles.disclosure} data-open={open}>
      <div className={styles.disclosureHeader}>
        <button
          type="button"
          className={`${styles.teacherSummary} ${styles.summary}`}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => {
            const next = !open;
            setOpen(next);
            onOpenChange?.(next);
          }}
        >
          {summary}
        </button>
        {action && <div className={styles.disclosureAction}>{action}</div>}
      </div>
      <div id={id} className={styles.reveal} aria-hidden={!open} inert={!open}>
        <div className={styles.revealClip}>
          <div className={styles.revealContent}>{children}</div>
        </div>
      </div>
    </div>
  );
}
