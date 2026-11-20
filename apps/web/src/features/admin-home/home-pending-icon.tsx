import type { ReactElement, ReactNode } from "react";
import { CircleAlert, CircleHelp, type LucideIcon } from "lucide-react";
import styles from "./home-pending.module.css";

export function PendingIcon({
  icon: Icon,
  className = "",
  missing = false,
  attention = false,
  children,
}: {
  icon: LucideIcon;
  className?: string | undefined;
  missing?: boolean;
  attention?: boolean;
  children?: ReactNode;
}): ReactElement {
  const Marker = attention ? CircleAlert : CircleHelp;
  const marked = missing || attention;
  return (
    <span
      className={`${styles.icon} ${className} ${marked ? styles.markedIcon : ""}`}
      aria-hidden="true"
    >
      <Icon />
      {children}
      {marked && <Marker className={styles.iconAttention} />}
    </span>
  );
}
