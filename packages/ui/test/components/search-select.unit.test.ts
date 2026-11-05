import assert from "node:assert/strict";
import { it } from "node:test";
import { searchIsOpen } from "../../src/components/search-select.js";

void it("offers new payer creation when a successful search has no matches", () => {
  const payerSearch = {
    query: "Maria Souza",
    minQueryLength: 1,
    resultsOnly: true,
    options: [],
    onCreate: () => {},
  };
  assert.equal(searchIsOpen(true, payerSearch), true);
  assert.equal(searchIsOpen(true, { ...payerSearch, loading: true }), false);
  assert.equal(searchIsOpen(true, { ...payerSearch, failed: true }), false);
  assert.equal(
    searchIsOpen(true, {
      query: payerSearch.query,
      minQueryLength: 1,
      resultsOnly: true,
      options: [],
    }),
    false,
  );
  assert.equal(searchIsOpen(true, { ...payerSearch, query: " " }), false);
});
