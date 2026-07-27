# Prisma migrations

Prisma schema changes own ordinary tables, columns, relations, enums, and indexes. Generate and apply
those migrations with `pnpm prisma:migrate` from the repository root.

Raw SQL is limited to database constraints Prisma cannot express:

- CHECK constraints;
- partial unique indexes;
- exclusion constraints.
- Postgres-specific setup required by schema-declared indexes (for example `CREATE EXTENSION pg_trgm`).

For one of those unsupported features, create a Prisma migration without applying it:

```bash
pnpm --filter @lazuli/db exec prisma migrate dev --create-only --name constraint_<name>
```

Edit only that generated `migration.sql`, then apply it with `pnpm prisma:migrate`. Never edit an
already-applied migration. Do not use this channel for ordinary schema changes or cross-entity triggers.
