import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  homeHrefFor,
  matchesNavHref,
  navBreadcrumbFor,
  navItemsFor,
  navReturnFor,
  navSectionsFor,
  type NavSection,
} from "../../src/components/app-shell/nav-items.js";

const STUDENTS_PATH = "/alunos";
const TEACHERS_PATH = "/professores";
const LEADS_PATH = "/interessados";
const ANALYTICS_PATH = "/financeiro";
const CLASSES_PATH = "/turmas";
const ASSESSMENTS_PATH = "/avaliacoes";
const CLASS_RECORDS_PATH = "/aulas";
const APPOINTMENTS_PATH = "/atendimentos";
const NEXT_SEMESTER_PATH = "/proximo-semestre";
const FOLLOW_UP_PATH = "/acompanhamento";
const PLANNING_PATH = "/planejamento";
const RECEIVABLES_PATH = "/recebiveis";
const CONTRACTS_PATH = "/contratos";
const SETTINGS_PATH = "/ajustes";
const ACTIVITY_PATH = "/atividades";
const STUDENTS_LABEL = "Alunos";
const PEDAGOGICAL_LABEL = "Pedagógico";

function sectionSummary(section: NavSection): { label: string | null; items: string[] } {
  return { label: section.label, items: section.items.map((item) => item.label) };
}

function sectionsSummary(sections: NavSection[]): ReturnType<typeof sectionSummary>[] {
  return sections.map((section) => sectionSummary(section));
}

void describe("role-aware navigation", () => {
  void it("shows administrative organization only to administrators and teaching work to teachers", () => {
    assert.deepEqual(
      navItemsFor("ADMIN").map((item) => item.href),
      [
        "/",
        STUDENTS_PATH,
        TEACHERS_PATH,
        CLASSES_PATH,
        CLASS_RECORDS_PATH,
        APPOINTMENTS_PATH,
        FOLLOW_UP_PATH,
        PLANNING_PATH,
        NEXT_SEMESTER_PATH,
        LEADS_PATH,
        ANALYTICS_PATH,
        CONTRACTS_PATH,
        RECEIVABLES_PATH,
        ACTIVITY_PATH,
      ],
    );
    assert.deepEqual(
      navItemsFor("TEACHER").map((item) => item.href),
      ["/", CLASS_RECORDS_PATH, APPOINTMENTS_PATH, FOLLOW_UP_PATH, PLANNING_PATH, ASSESSMENTS_PATH],
    );
  });

  void it("places Alunos, Professores and Turmas under Pedagógico and hides empty sections", () => {
    assert.deepEqual(sectionsSummary(navSectionsFor("ADMIN")), [
      { label: null, items: ["Início"] },
      {
        label: PEDAGOGICAL_LABEL,
        items: [
          STUDENTS_LABEL,
          "Professores",
          "Turmas",
          "Aulas",
          "Atendimentos",
          "Acompanhamento",
          "Planejamento",
          "Próximo semestre",
        ],
      },
      { label: "Comercial", items: ["Leads"] },
      { label: "Financeiro", items: ["Visão financeira", "Contratos", "Recebíveis"] },
      { label: "Sistema", items: ["Log de atividades"] },
    ]);
    assert.deepEqual(
      navSectionsFor("TEACHER").map((section) => section.label),
      [null, PEDAGOGICAL_LABEL],
    );
  });

  void it("resolves the grouped page breadcrumb from current and child routes", () => {
    assert.deepEqual(navBreadcrumbFor(STUDENTS_PATH, "ADMIN"), {
      section: PEDAGOGICAL_LABEL,
      page: STUDENTS_LABEL,
    });
    assert.deepEqual(navBreadcrumbFor(`${STUDENTS_PATH}/um-id`, "ADMIN"), {
      section: PEDAGOGICAL_LABEL,
      page: STUDENTS_LABEL,
    });
    assert.deepEqual(navBreadcrumbFor(`${CLASSES_PATH}/um-id`, "ADMIN"), {
      section: PEDAGOGICAL_LABEL,
      page: "Turmas",
    });
    assert.equal(navBreadcrumbFor(STUDENTS_PATH, "TEACHER"), null);
    assert.equal(navBreadcrumbFor("/", "ADMIN"), null);
    assert.equal(matchesNavHref({ href: STUDENTS_PATH, pathname: "/alunos-inativos" }), false);
  });

  void it("sends Início to the role's first vertical, or nowhere", () => {
    assert.equal(homeHrefFor("ADMIN"), STUDENTS_PATH);
    assert.equal(homeHrefFor("TEACHER"), CLASS_RECORDS_PATH);
    assert.equal(homeHrefFor("SECRETARY"), null);
    assert.equal(homeHrefFor("FINANCE"), null);
  });
});

void it("limits Financeiro to ADMIN and supplies its breadcrumb", () => {
  assert.deepEqual(navBreadcrumbFor(CONTRACTS_PATH, "ADMIN"), {
    section: "Financeiro",
    page: "Contratos",
  });
  assert.deepEqual(navBreadcrumbFor(RECEIVABLES_PATH, "ADMIN"), {
    section: "Financeiro",
    page: "Recebíveis",
  });
  for (const role of ["SECRETARY", "FINANCE", "TEACHER"] as const) {
    assert.equal(navBreadcrumbFor(RECEIVABLES_PATH, role), null);
    assert.deepEqual(
      navItemsFor(role).map((item) => item.href),
      role === "TEACHER"
        ? [
            "/",
            CLASS_RECORDS_PATH,
            APPOINTMENTS_PATH,
            FOLLOW_UP_PATH,
            PLANNING_PATH,
            ASSESSMENTS_PATH,
          ]
        : ["/"],
    );
  }
});

void it("shows Ajustes only to SYSTEM_ADMIN while preserving inherited navigation", () => {
  assert.deepEqual(
    navItemsFor("SYSTEM_ADMIN").map((item) => item.href),
    [
      "/",
      STUDENTS_PATH,
      TEACHERS_PATH,
      CLASSES_PATH,
      CLASS_RECORDS_PATH,
      APPOINTMENTS_PATH,
      FOLLOW_UP_PATH,
      PLANNING_PATH,
      NEXT_SEMESTER_PATH,
      LEADS_PATH,
      ANALYTICS_PATH,
      CONTRACTS_PATH,
      RECEIVABLES_PATH,
      ACTIVITY_PATH,
      SETTINGS_PATH,
    ],
  );
  assert.equal(
    navItemsFor("ADMIN").some((item) => item.href === SETTINGS_PATH),
    false,
  );
  assert.deepEqual(navBreadcrumbFor(SETTINGS_PATH, "SYSTEM_ADMIN"), {
    section: "Sistema",
    page: "Ajustes",
  });
});

void it("returns child pages to the authorized list with its filters and ignores foreign destinations", () => {
  assert.deepEqual(
    navReturnFor({ pathname: "/turmas/a-class", role: "ADMIN", back: "/turmas?search=C2&page=2" }),
    {
      href: "/turmas?search=C2&page=2",
      label: "Turmas",
    },
  );
  for (const back of [
    null,
    "//elsewhere.test",
    "/turmas-other",
    "/turmas/another-class",
    "https://elsewhere.test",
  ]) {
    assert.deepEqual(navReturnFor({ pathname: "/turmas/a-class", role: "ADMIN", back }), {
      href: "/turmas",
      label: "Turmas",
    });
  }
  assert.equal(navReturnFor({ pathname: "/turmas", role: "ADMIN", back: null }), null);
  assert.equal(navReturnFor({ pathname: "/turmas/a-class", role: "TEACHER", back: null }), null);
});
