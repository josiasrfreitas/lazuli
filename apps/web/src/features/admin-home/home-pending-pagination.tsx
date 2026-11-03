import type { ReactElement } from "react";
import { Button } from "@lazuli/ui";
import styles from "./home-pending.module.css";

export const PENDING_PAGE_SIZE = 4;

export function PendingPagination({
  total,
  page,
  onPageChange,
  label,
}: {
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  label: string;
}): ReactElement | null {
  if (total <= PENDING_PAGE_SIZE) return null;
  const pages = Math.ceil(total / PENDING_PAGE_SIZE);
  return (
    <nav className={styles.placementPagination} aria-label={label}>
      <Button
        variant="ghost"
        size="sm"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        Anterior
      </Button>
      <span>
        Página {page} de {pages}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
      >
        Próxima
      </Button>
    </nav>
  );
}
