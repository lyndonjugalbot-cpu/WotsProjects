# Virtual Bridge PH — Platform

Monorepo for the Virtual Bridge PH client/VA/admin platform.

```
apps/
  web/          Next.js app (App Router, TypeScript, Tailwind v4)
  desktop/      Tauri + React time tracker (Phase 12+, not scaffolded yet)
packages/
  ui/           Shared component library (shadcn-pattern, VBPH-themed)
  types/        Shared TypeScript types (DB types, DTOs)
  schemas/      Shared Zod validation schemas
  supabase/     Anon-key Supabase client factory ONLY — see security note in src/index.ts
  config/       Shared tsconfig, eslint, and Tailwind theme tokens
supabase/
  migrations/   Postgres migrations (empty — Phase 1 adds the first one)
```

## Getting started

```bash
pnpm install
cp apps/web/.env.local.example apps/web/.env.local   # then fill in your Supabase project's keys
pnpm dev          # http://localhost:3000
```

## Common commands (run from repo root)

```bash
pnpm dev          # start apps/web
pnpm lint         # lint every package
pnpm typecheck    # typecheck every package
pnpm build        # build every package
```

## Where things live

- **Never** put the Supabase service-role key anywhere except `apps/web/src/lib/supabase/admin.ts` (doesn't exist yet — arrives Phase 1). It must never end up in `packages/supabase`, since that package is also a dependency of the desktop app.
- Server-only data access (the Data Access Layer) lives in `apps/web/src/server/queries/{client,va,admin}` and `apps/web/src/server/actions/` once Phase 1+ adds them — each guarded with `import 'server-only'`.
