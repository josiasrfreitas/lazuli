# Student profile client cost — 4 November 2026

The local production profile's initial JavaScript fell **37.5% in estimated Brotli bytes**, without application data caching. This establishes a smaller initial bundle; it does not establish the 300 ms interaction target.

| Initial assets         |    Before |     After |
| ---------------------- | --------: | --------: |
| JavaScript files       |        36 |        26 |
| Raw JavaScript bytes   | 2,446,420 | 1,489,871 |
| Estimated Brotli bytes |   612,186 |   382,842 |

Both builds used Next 16.2.12, Turbopack and the same configuration. The measurement takes the final `entryJSFiles` entry from the profile's client-reference manifest, deduplicates asset paths and compresses each file separately. This matches the historical estimate's rule. It includes shared initial assets; it is not network transfer, CPU time or all reachable async code. [The artifact](student-client-cost-2026-11-04.json) preserves both build IDs, asset inventories, source/configuration fingerprints and results.

| Finding                                                                       | Executed action                                                                                           | Acceptance evidence                                                                                                                                                                                     |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1: Closed header agenda eagerly imported calendar and record editors         | Lightweight action loads the agenda only on activation or an appointment deep link                        | Agenda opens with calendar, focus enters, Escape restores trigger focus and reopening works. First opening loaded 4 deferred scripts, 207,768 decoded bytes.                                            |
| C2: Inactive registration, pedagogy, finance and planning sections were eager | Dynamic section imports with existing loading states; extract lightweight registration/document skeletons | Overview, registration documents, finance charges and pedagogy enrollment rendered in the production browser. The combined C1–C3 build produced the reduction above; savings were not isolated per cut. |
| C3: Header photo eagerly imported document capture                            | Load capture only when its editing UI renders                                                             | Photo dialog shows file selection and cancels; no file uploaded or camera capture performed.                                                                                                            |

The native Turbopack analyzer ran successfully. Its reachable client graph, **including deferred chunks**, contained PDF.js (432,181 emitted raw bytes), Recharts (289,934), react-big-calendar (167,397) and scanic (105,381). PDF.js and scanic already used dynamic imports; their presence in that graph did not prove initial loading. The closed `NewStudentDialog` in overview pending actions is a remaining candidate requiring separate measurement, rather than an assumed saving.

Runtime tracing through Orca worked, and a reusable probe collects Event Timing, long tasks, long animation frames and interaction-to-functional-readiness. However, embedded-tab focus and frame scheduling were unstable, including approximately one-second frame gaps. Attempts lack comparable valid foreground evidence; **no latency improvement, p95, Lighthouse TBT or field INP is claimed**. The latest probe rejects incomplete readiness and focus/visibility interruptions. Profile readiness must include health, enrollment and pending actions, rather than only the header's `data-ready` attribute.

Precise JavaScript Coverage was not exposed by the installed Orca CLI. Browser tooling was not switched. A nonexistent appointment deep link automatically opened the expected error dialog; a valid appointment detail deep link was not exercised. Production builds, web typecheck and focused lint passed; lint retained three existing photo styling warnings. Full checks remain for the delivery gate.

Reproduce the bundle estimate after a production build:

```sh
node scripts/measure-staging-client-bundles.mjs apps/web/.next --include-assets
pnpm -F @lazuli/web exec next experimental-analyze --output
node scripts/summarize-client-analysis.mjs apps/web/.next/diagnostics/analyze 'alunos/[id]'
```

The native analyzer supplies the interactive module map without adding a Webpack analyzer to this Turbopack application. The summary parser targets Next 16.2's experimental format. For a foreground Orca page, arm a probe before a real click, wait for functional content, then read it:

```sh
node scripts/measure-client-interaction.mjs PAGE arm profile 'div[data-ready=true]:has(#student-health-title):not(:has([aria-busy=true])):not(:has([role=status]))'
node scripts/measure-client-interaction.mjs PAGE read
```

The observer's blocking total covers its observation window and is not Lighthouse TBT. Its maximum event duration is a controlled sample, not field INP. See the official [Next analyzer guidance](https://nextjs.org/docs/app/api-reference/cli/next) and [TBT definition](https://web.dev/articles/tbt).
