# Lint

`pnpm lint` runs Oxlint through `lazuli-lint`, plus the existing duplication gate.
Each workspace has an `.oxlintrc.json` extending `base.json`. The directory name
`tooling/eslint` remains stable for existing tooling and decision-record links.

Oxlint and `oxlint-tsgolint` are pinned together. Native rules handle the supported
JavaScript and TypeScript checks. JavaScript plugins preserve Security, SonarJS,
unused imports, architectural path restrictions, and Unicorn rules without native
parity. `compat.js` loads the original ESLint implementations of selected core
rules. ESLint remains a plugin runtime dependency; it no longer runs the lint gate.

The compatibility aliases deliberately keep `import-x/no-cycle` and
`no-restricted-paths`, plus Unicorn's `consistent-function-scoping`,
`numeric-separators-style`, and `no-document-cookie`: the native implementations
produced different diagnostics on existing source. The six Unicorn rules omitted
by the migration tool also keep their original implementations. Core compatibility
rules are `no-undef`, `no-useless-assignment`, `no-restricted-syntax`, `id-length`,
and `no-magic-numbers`. Preserve these aliases when updating rule options.

`eslint-suppressions.json` retains the existing per-file, per-rule error counts.
The runner maps Oxlint rule identifiers to the original identifiers before applying
those counts. Exceeding an allowance reports every violation of that rule in the
file. Unused allowances fail, including when the checked file has become clean.
Only files selected by Oxlint participate, so linting one file does not invalidate
allowances in other files. Use `lazuli-lint` for the authoritative result; invoking
the raw Oxlint binary bypasses this allowance layer.

Inline disable comments are allowed. Unused directives remain errors. Generated
code ignores, test-directory readability exceptions, package boundaries, shadcn
settings, and error/warning severities remain in the configurations.

`test:quality:changed` also uses Oxlint. It still reads staged content for `--staged`
and reports findings only for new files or touched test functions. Temporary copies
let Oxlint check that exact content without modifying the working tree.

Run `pnpm -F @lazuli/eslint-config test` to exercise architectural boundaries,
type-aware checks, test-quality rules, hooks, staged content, and suppression limits.
