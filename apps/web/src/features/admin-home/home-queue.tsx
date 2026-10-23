import { useState, type ReactElement } from "react";
import { CheckCheck, ChevronRight } from "lucide-react";
import { Button } from "@lazuli/ui";
import { GroupDetail } from "./group-detail";
import type { HomeData, HomeGroup, OpenAction } from "./home-parts";
import styles from "./home.module.css";

type Area = "all" | HomeGroup["area"];
const AREA_LABELS = {
  all: "Tudo",
  school: "Escola",
  admissions: "Comercial",
  finance: "Contratos",
};
export function HomeQueue({
  data,
  selected,
  select,
  open,
}: {
  data: HomeData;
  selected: HomeGroup | null;
  select: (group: HomeGroup | null) => void;
  open: OpenAction;
}): ReactElement {
  const [area, setArea] = useState<Area>("all");
  const groups = data.groups.filter((group) => area === "all" || group.area === area);
  return (
    <section id="home-work" tabIndex={-1} className={styles.work} aria-labelledby="home-work-title">
      {selected ? (
        <GroupDetail key={selected.kind} group={selected} close={() => select(null)} open={open} />
      ) : (
        <>
          <div className={styles.sectionHeading}>
            <h2 id="home-work-title">O que vamos cuidar?</h2>
            <span>{data.groups.reduce((sum, group) => sum + group.total, 0)} ações</span>
          </div>
          <p className={styles.description}>
            Cada passo no seu lugar. Uma pessoa pode ter mais de uma ação.
          </p>
          <AreaFilters area={area} setArea={setArea} finance={data.canViewFinance} />
          <QueueSection
            title="Precisa de atenção"
            groups={groups.filter((group) => group.attention)}
            select={select}
            attention
          />
          <QueueSection
            title="Próximos passos"
            groups={groups.filter((group) => !group.attention)}
            select={select}
          />
        </>
      )}
    </section>
  );
}
function QueueSection({
  title,
  groups,
  select,
  attention = false,
}: {
  title: string;
  groups: HomeGroup[];
  select: (group: HomeGroup) => void;
  attention?: boolean;
}): ReactElement | null {
  if (groups.length === 0) return null;
  const pending = groups.filter((group) => group.total > 0);
  return (
    <div className={styles.queueSection}>
      <h3 data-attention={attention || undefined}>{title}</h3>
      {pending.length > 0 ? (
        <ul className={styles.groupList}>
          {pending.map((group) => (
            <li key={group.kind}>
              <button type="button" className={styles.group} onClick={() => select(group)}>
                <span className={styles.groupCount}>{group.total.toLocaleString("pt-BR")}</span>
                <span className={styles.groupCopy}>
                  <strong>{group.title}</strong>
                  <span>{group.description}</span>
                </span>
                <ChevronRight aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.clear}>
          <CheckCheck aria-hidden="true" />
          <p>
            {attention
              ? "Tudo certo por aqui. Nenhuma ação deste grupo precisa de atenção."
              : "Nenhum próximo passo pendente nesta área."}
          </p>
        </div>
      )}
    </div>
  );
}

function AreaFilters({
  area,
  setArea,
  finance,
}: {
  area: Area;
  setArea: (area: Area) => void;
  finance: boolean;
}): ReactElement {
  return (
    <div className={styles.filters} role="group" aria-label="Filtrar pendências por área">
      {(Object.entries(AREA_LABELS) as [Area, string][])
        .filter(([key]) => key !== "finance" || finance)
        .map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={area === key ? "secondary" : "ghost"}
            aria-pressed={area === key}
            onClick={() => setArea(key)}
          >
            {label}
          </Button>
        ))}
    </div>
  );
}
