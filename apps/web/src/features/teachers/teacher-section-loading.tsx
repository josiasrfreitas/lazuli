import type { ReactElement } from "react";
import { BriefcaseBusiness, UserRound } from "lucide-react";
import { AttachmentPanel, InlineSkeleton } from "@lazuli/ui";
import layout from "../students/profile/student-overview.module.css";
import shared from "../students/profile/student-registration.module.css";
import loading from "../students/profile/student-loading.module.css";
import registration from "./teacher-registration.module.css";
import { TeacherClassMetricsLoading } from "./teacher-class-metrics-loading";

export function TeacherRegistrationLoading(): ReactElement {
  return (
    <div
      className={registration.layout}
      aria-busy="true"
      aria-label="Carregando cadastro do professor"
    >
      <div className={`${layout.registrationFacts} ${loading.surface}`}>
        {[
          {
            title: "Dados pessoais",
            Icon: UserRound,
            labels: ["Nome completo", "CPF", "Telefone", "E-mail"],
          },
          {
            title: "Contratação",
            Icon: BriefcaseBusiness,
            labels: ["Tipo de vínculo", "Observações"],
          },
        ].map(({ title, Icon, labels }) => (
          <section key={title} className={shared.section}>
            <div className={shared.sectionHeading}>
              <h2 className={shared.sectionTitle}>
                <Icon aria-hidden="true" />
                {title}
              </h2>
            </div>
            <dl className={registration.facts}>
              {labels.map((label) => (
                <div key={label} className={shared.fact}>
                  <dt>{label}</dt>
                  <dd>
                    <InlineSkeleton className="w-32 max-w-full" />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <div className={registration.documents}>
        <TeacherAttachmentsLoading />
      </div>
    </div>
  );
}

export function TeacherAttachmentsLoading(): ReactElement {
  return (
    <AttachmentPanel title="Anexos do professor" busy className={loading.surface}>
      <div aria-busy="true" aria-label="Carregando anexos" className="grid gap-5">
        <InlineSkeleton className="w-4/5" />
        {[0, 1].map((row) => (
          <div key={row} className="flex items-center justify-between gap-4" aria-hidden="true">
            <div className="grid min-w-0 flex-1 gap-2">
              <InlineSkeleton className="w-32 max-w-full" />
              <InlineSkeleton className="w-48 max-w-full" />
            </div>
            <InlineSkeleton shape="block" className="h-8 w-20" />
          </div>
        ))}
        <InlineSkeleton shape="block" className="h-8 w-full" />
      </div>
    </AttachmentPanel>
  );
}

export function TeacherClassesPanelLoading(): ReactElement {
  return (
    <section className="grid gap-4" aria-busy="true" aria-label="Carregando turmas e agenda">
      <InlineSkeleton className="h-8 w-48" />
      <TeacherClassMetricsLoading />
    </section>
  );
}
