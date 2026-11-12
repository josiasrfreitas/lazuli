import { InlineSkeleton } from "@lazuli/ui";
import { MONTHS } from "./workshop-data";
import styles from "./workshop.module.css";

export function AcademicCalendarLoading() {
  return (
    <div
      className={styles.page}
      role="status"
      aria-label="Carregando calendário acadêmico"
      aria-busy="true"
    >
      <div className={styles.header}>
        <h1>Calendário acadêmico</h1>
        <InlineSkeleton className="h-8 w-48" shape="block" />
      </div>
      <div className={styles.legend}>
        <InlineSkeleton className="w-64" />
      </div>
      {[0, 1].map((semester) => (
        <section key={semester} className="grid gap-4">
          <h2>{semester + 1}º semestre</h2>
          <div className={styles.months} data-direction="semesters">
            {MONTHS.slice(semester * 6, semester * 6 + 6).map((month) => (
              <div key={month} className={styles.month}>
                <div className={styles.monthHeading}>
                  <h3>{month}</h3>
                </div>
                <div className="grid gap-2" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, i) => (
                    <InlineSkeleton key={i} className="h-6 w-full" shape="block" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
