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
const CLASSES_PATH = "/turmas";
const RECEIVABLES_PATH = "/recebiveis";
const CONTRACTS_PATH = "/contratos";
const SETTINGS_PATH = "/ajustes";
const STUDENTS_LABEL = "Alunos";
const PEDAGOGICAL_LABEL = "Pedagógico";

function sectionSummary(section: NavSection): { label: string | null; items: string[] } {
  return { label: section.label, items: section.items.map((item) => item.label) };
}

function sectionsSummary(sections: NavSection[]): ReturnType<typeof sectionSummary>[] {
  return sections.map((section) => sectionSummary(section));
}

void describe("role-aware navigation", () => {
  void it("shows Alunos and Turmas only to roles their procedures accept", () => {
    assert.deepEqual(
      navItemsFor("ADMIN").map((item) => item.href),
      ["/", STUDENTS_PATH, CLASSES_PATH, CONTRACTS_PATH, RECEIVABLES_PATH],
    );
    assert.deepEqual(
      navItemsFor("TEACHER").map((item) => item.href),
      ["/"],
    );
  });

  void it("places Alunos and Turmas under Pedagógico and hides empty sections", () => {
    assert.deepEqual(sectionsSummary(navSectionsFor("ADMIN")), [
      { label: null, items: ["Início"] },
      { label: PEDAGOGICAL_LABEL, items: [STUDENTS_LABEL, "Turmas"] },
      { label: "Financeiro", items: ["Contratos", "Recebíveis"] },
    ]);
    assert.deepEqual(
      navSectionsFor("TEACHER").map((section) => section.label),
      [null],
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
    assert.equal(homeHrefFor("TEACHER"), null);
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
      ["/"],
    );
  }
});

void it("shows Ajustes only to SYSTEM_ADMIN while preserving inherited navigation", () => {
  assert.deepEqual(
    navItemsFor("SYSTEM_ADMIN").map((item) => item.href),
    ["/", STUDENTS_PATH, CLASSES_PATH, CONTRACTS_PATH, RECEIVABLES_PATH, SETTINGS_PATH],
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
  assert.deepEqual(navReturnFor("/turmas/a-class", "ADMIN", "/turmas?search=C2&page=2"), {
    href: "/turmas?search=C2&page=2",
    label: "Turmas",
  });
  for (const back of [
    null,
    "//elsewhere.test",
    "/turmas-other",
    "/turmas/another-class",
    "https://elsewhere.test",
  ]) {
    assert.deepEqual(navReturnFor("/turmas/a-class", "ADMIN", back), {
      href: "/turmas",
      label: "Turmas",
    });
  }
  assert.equal(navReturnFor("/turmas", "ADMIN", null), null);
  assert.equal(navReturnFor("/turmas/a-class", "TEACHER", null), null);
});
