"use client";
import { useState, type ReactElement } from "react";
import { parseAsInteger, parseAsString, useQueryStates, useQueryState } from "nuqs";
import { Button, DataTablePage } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { classListQueryInput } from "./class-list-model";
import { classFilterFields } from "./class-filter-fields";
import { ClassFilters } from "./class-list-filters";
import { ClassListTable } from "./class-list-table";
import { ClassCreateDialog } from "./create-dialog";
import { ClassOrganizationPage } from "~/features/class-organization/page";
import styles from "~/features/class-organization/organization.module.css";

export function ClassesPage({
  organizationEnabled = false,
}: {
  organizationEnabled?: boolean;
}): ReactElement {
  const [section, setSection] = useQueryState("secao", parseAsString.withDefault("lista"));
  return (
    <div data-page-scroll="internal" className={styles.classesArea}>
      {organizationEnabled && (
        <nav className={styles.areaTabs} aria-label="Área de turmas">
          <Button
            size="sm"
            variant={section === "lista" ? "secondary" : "ghost"}
            aria-pressed={section === "lista"}
            onClick={() => void setSection("lista")}
          >
            Turmas
          </Button>
          <Button
            size="sm"
            variant={section === "organizacao" ? "secondary" : "ghost"}
            aria-pressed={section === "organizacao"}
            onClick={() => void setSection("organizacao")}
          >
            Organização
          </Button>
        </nav>
      )}
      <div className={styles.classesContent}>
        {organizationEnabled && section === "organizacao" ? (
          <ClassOrganizationPage />
        ) : (
          <ClassListing />
        )}
      </div>
    </div>
  );
}

function ClassListing(): ReactElement {
  const [params, setParams] = useQueryStates({
    busca: parseAsString.withDefault(""),
    tipo: parseAsString,
    formato: parseAsString,
    professor: parseAsString,
    estagio: parseAsString,
    semestre: parseAsString,
    estado: parseAsString,
    pagina: parseAsInteger.withDefault(1),
  });
  const [creating, setCreating] = useState(false);
  const query = trpc.classes.list.useQuery(classListQueryInput(params));
  const options = trpc.classes.formOptions.useQuery();
  const fields = classFilterFields({
    params,
    options: options.data,
    change: (value) => void setParams(value),
  });
  return (
    <>
      <DataTablePage
        title="Turmas"
        summary={query.data ? `${query.data.total} turmas` : undefined}
        controls={
          <ClassFilters
            params={params}
            fields={fields}
            change={(value) => void setParams(value)}
            create={() => setCreating(true)}
          />
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-2">
          <div className="min-h-0 flex-1">
            <ClassListTable
              data={query.data}
              isError={query.isError}
              refetch={() => void query.refetch()}
              params={params}
              setPage={(page) => void setParams({ pagina: page })}
            />
          </div>
        </div>
      </DataTablePage>
      <ClassCreateDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
