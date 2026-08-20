// Shared Zod validation schemas — the single source of truth for input shapes.
//
// These validate a payload in two places with the same rules: server-side in
// apps/web (Server Actions/route handlers always re-validate, per Next.js's
// own data-security guidance — never trust that client-side validation ran),
// and client-side in apps/desktop before the time tracker syncs a payload.
//
// Phase 7 will add TimeBlockSchema / ScreenshotSchema for the tracker.

export * from "./admin";
export * from "./applications";
export * from "./auth";
export * from "./jobs";
export * from "./time-tracking";
export * from "./timesheets";
export * from "./invoices";
