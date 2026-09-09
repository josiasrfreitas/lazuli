---
name: ship-with-tests
description: >-
  Apply Lazuli's testing guidance from the beginning of every code change, including when existing
  tests are sufficient or no new test is justified. Skip for documentation-only changes.
---

# Ship With Tests

Read [`docs/testing/README.md`](../../../docs/testing/README.md) before changing code or tests. Use
[`CONTEXT.md`](../../../CONTEXT.md) for area and subject names.

At the start, answer:

1. Which contract does this change protect?
2. Which plausible defect should the protection detect?
3. Why is the expectation correct independently of the implementation?

Inspect existing tests before choosing whether to add or alter one. Select the cheapest tier that
proves the contract, implement the change, and review every touched test function as a whole against
the guide. Helpers, parametrization, mocks, and existing tests may be the right evidence; do not add
a decorative assertion merely to satisfy a check.

Before handing off, inspect the diff and briefly report the protected behavior, checks run, and any
checks left pending with a concrete reason. If guidance and an executable check remain incompatible
after reconsidering the approach once, ask the owner instead of weakening the expectation or gate.
