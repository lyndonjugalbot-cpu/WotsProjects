// Shared TypeScript types, consumed by apps/web and (later) apps/desktop.
//
// Phase 5+ will add per-portal DTO types (e.g. ClientJobDTO, VaJobDTO) that
// intentionally omit fields that portal must never see (see the rate-privacy
// design in the architecture doc) — the DTO's TypeScript shape is itself one
// of the enforcement layers, not just documentation.

export * from "./database";
export * from "./aliases";
