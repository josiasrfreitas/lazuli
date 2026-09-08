import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { debounce } from "../src/lib/debounce.js";

const WAIT_MS = 300;

void describe("debounce", () => {
  void it("commits only the latest value after the quiet period", (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const committed: string[] = [];
    const commit = debounce((value: string) => committed.push(value), WAIT_MS);

    commit("a");
    commit("an");
    context.mock.timers.tick(WAIT_MS - 1);
    assert.deepEqual(committed, []);

    commit("ana");
    context.mock.timers.tick(WAIT_MS);
    assert.deepEqual(committed, ["ana"]);
  });

  void it("can cancel a pending commit", (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const committed: string[] = [];
    const commit = debounce((value: string) => committed.push(value), WAIT_MS);

    commit("ana");
    commit.cancel();
    context.mock.timers.tick(WAIT_MS);

    assert.deepEqual(committed, []);
  });
});
