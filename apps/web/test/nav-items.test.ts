import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { homeHrefFor, navItemsFor } from "../src/components/app-shell/nav-items.js";

void describe("role-aware navigation", () => {
  void it("shows Alunos only to roles its procedures accept", () => {
    assert.deepEqual(
      navItemsFor("ADMIN").map((item) => item.href),
      ["/", "/alunos"],
    );
    assert.deepEqual(
      navItemsFor("TEACHER").map((item) => item.href),
      ["/"],
    );
  });

  void it("sends Início to the role's first vertical, or nowhere", () => {
    assert.equal(homeHrefFor("ADMIN"), "/alunos");
    assert.equal(homeHrefFor("TEACHER"), null);
    assert.equal(homeHrefFor("SECRETARY"), null);
    assert.equal(homeHrefFor("FINANCE"), null);
  });
});
