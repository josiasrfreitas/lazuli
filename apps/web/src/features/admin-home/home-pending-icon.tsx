import type { ReactElement, ReactNode } from "react";
import { CircleHelp, type LucideIcon } from "lucide-react";
import styles from "./home-pending.module.css";

export function PendingIcon({
  icon: Icon,
  className = "",
  missing = false,
  children,
}: {
  icon: LucideIcon;
  className?: string | undefined;
  missing?: boolean;
  children?: ReactNode;
}): ReactElement {
  return (
    <span
      className={`${styles.icon} ${className} ${missing ? styles.missingIcon : ""}`}
      aria-hidden="true"
    >
      <Icon />
      {children}
      {missing && <CircleHelp className={styles.iconAttention} />}
    </span>
  );
}
