# Organizing frontend features

## What `features` means here

`features` is a team organization choice, not a Next.js or React folder convention. The Next.js App Router uses special files such as `page.tsx` and `route.ts` to define public routes, while leaving the broader organization of project files to the team. Its documented strategies include keeping shared code outside `app`, colocating code in `app`, and splitting code by feature or route. [Next.js: Project Structure](https://nextjs.org/docs/app/getting-started/project-structure)

In this app, `src/app` is the routing and framework boundary; `src/features` holds product-specific UI for the school's operational areas. For example, `(app)/alunos/page.tsx` delegates to `features/students`, and the contracts, installments, and settings routes do the same for their corresponding feature folders. Those folders contain the page composition and supporting components, view models, and logic used by that area. This keeps a vertical's implementation discoverable together without making every implementation file part of the route tree.

React's guidance supports decomposing UI around component responsibilities and the shape of the data being displayed, but does not prescribe feature folders. So the useful rationale is practical ownership and locality: a change to student enrollment can usually be explored within `features/students`, while route-specific concerns remain visible in `app`. [React: Thinking in React](https://react.dev/learn/thinking-in-react)

## Practical boundary for this repo

- Keep code in `features/<area>` when it implements a product workflow or UI owned by that area, including its page composition, local state, view model, and private components.
- Keep route entry points and Next.js special files in `app`; keep app-wide shell pieces in `components/app-shell` and generic frontend helpers in `lib`.
- Move a component to shared UI only when multiple areas use the same stable behavior or presentation contract. Reuse alone is not a reason to create a broad abstraction.
- Treat feature folders as an organizational boundary, not a runtime, package, or security boundary. Cross-feature dependencies can still create coupling, so shared concepts should have a clear owner.

The `@features/*` alias could make imports express this existing boundary, but the alias itself would only shorten paths. It would not make the feature boundary enforced or change Next.js routing. Current `tsconfig.json` maps both `@/*` and `~/*` to `src/*`; choosing one import spelling is a separate consistency decision.

## Sources and limits

- [Next.js: Project Structure](https://nextjs.org/docs/app/getting-started/project-structure) — current App Router organization, colocation, route conventions, and feature/route strategy.
- [React: Thinking in React](https://react.dev/learn/thinking-in-react) — component decomposition and state ownership principles; it does not define filesystem layout.

These sources establish framework behavior and general UI design guidance, not a universal definition of “feature.” The recommendation above is an application of those sources to the current Lazuli tree and its existing separation between routes, feature UI, shared components, and helpers.
