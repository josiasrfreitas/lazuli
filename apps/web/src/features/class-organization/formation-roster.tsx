import type { ReactElement } from "react";
import { ChevronRight } from "lucide-react";
import type { OrganizationBoard } from "./model";
import type { PanelPerson } from "./use-formation-navigation";
import styles from "./formation.module.css";

export function LeadItem({
  lead,
  onSelect,
}: {
  lead: OrganizationBoard["waitingLeads"][number];
  onSelect: (person: PanelPerson, origin: HTMLElement) => void;
}): ReactElement {
  return (
    <button
      type="button"
      className={styles.item}
      data-formation-focus={`lead-${lead.id}`}
      onClick={(event) => onSelect({ kind: "lead", id: lead.id }, event.currentTarget)}
    >
      <span>
        <strong>{lead.fullName}</strong>
        <small>
          Lead · {lead.stage?.internalCode ?? "Estágio a definir"}
          {lead.allocationPlanId ? " · Turma proposta" : ""}
        </small>
      </span>
      <ChevronRight size={14} />
    </button>
  );
}
