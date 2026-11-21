import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@lazuli/ui";
import styles from "./operations.module.css";
import type { ReactElement } from "react";

export function AnalyticsFilters({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="secondary" size="sm" />}>
        <SlidersHorizontal aria-hidden="true" />
        {label}
      </PopoverTrigger>
      <PopoverContent size="sm" align="end" showArrow={false}>
        <div className={styles.filterFields}>{children}</div>
      </PopoverContent>
    </Popover>
  );
}
