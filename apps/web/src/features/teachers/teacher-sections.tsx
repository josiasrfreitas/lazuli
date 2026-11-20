"use client";
import { useEffect, type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { useSearchParams } from "next/navigation";
import { TeacherHeader } from "./teacher-header";
import { TeacherHeaderLoading } from "./teacher-loading";
import { TeacherRegistrationLoading } from "./teacher-section-loading";
import { TeacherRegistration } from "./teacher-registration";
import { TeacherClassesPanel } from "./teacher-classes-panel";
import { TeacherStudents } from "./teacher-students";
import { TeacherMetrics } from "./teacher-metrics";
export function TeacherSections({
  id,
  teacher,
  onEdit,
  onDepart,
  back,
}: {
  id: string;
  teacher: RouterOutputs["teachers"]["byId"] | undefined;
  onEdit: () => void;
  onDepart: () => void;
  back: string;
}): ReactElement {
  const params = useSearchParams();
  const section = params.get("secao");
  const teacherId = teacher?.id;
  useEffect(() => {
    if (teacherId && section && ["cadastro", "visao-geral", "turmas", "alunos"].includes(section))
      document.querySelector(`#${section}`)?.scrollIntoView();
  }, [section, teacherId]);
  if (!teacher)
    return (
      <>
        <TeacherHeaderLoading />
        <TeacherRegistrationLoading />
      </>
    );
  return (
    <div className="grid min-w-0 gap-5 pb-6">
      <TeacherHeader
        teacher={teacher}
        onEdit={onEdit}
        onDepart={onDepart}
        navigation={
          <nav aria-label="Nesta ficha" className="flex flex-wrap gap-4 text-sm">
            <a href="#cadastro">Cadastro</a>
            <a href="#visao-geral">Indicadores</a>
            <a href="#turmas">Turmas e agenda</a>
            <a href="#alunos">Alunos</a>
          </nav>
        }
      />
      <section id="cadastro" aria-label="Cadastro">
        <TeacherRegistration teacher={teacher} onEdit={onEdit} />
      </section>
      <section id="visao-geral" aria-label="Indicadores">
        <TeacherMetrics
          id={id}
          onStudents={() => document.querySelector("#alunos")?.scrollIntoView()}
        />
      </section>
      <section id="turmas" className="grid min-w-0 gap-2">
        <h2 className="text-lg font-semibold">Turmas e agenda</h2>
        <TeacherClassesPanel id={id} back={back} />
      </section>
      <section id="alunos" className="grid min-w-0 gap-2">
        <h2 className="text-lg font-semibold">Alunos</h2>
        <TeacherStudents id={id} />
      </section>
    </div>
  );
}
