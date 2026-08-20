# Design system

Covers the UI/UX pass over `packages/ui` and `apps/web`: design tokens, the component library, and the interaction patterns (empty states, confirmation, tables, loading) applied consistently across all three portals (Admin / Client / VA). No business logic changed in this pass — every edit is presentational or a client/server component-boundary refactor of existing markup.

Original design system, not a copy of Upwork/Hubstaff/Deel/Stripe or any other product: brand palette is charcoal/orange/yellow/teal (matches the existing marketing site), the layout is a fixed sidebar + sticky header shell distinct from those products' top-nav or three-pane layouts, and the empty-state/confirm-dialog/table patterns below are custom-built (`packages/ui`), not a wrapped third-party component kit.

## Tokens — `packages/config/tailwind-theme.css`

Tailwind v4, CSS-first config (no `tailwind.config.js`). Tokens live as CSS custom properties on `:root`, re-exposed to Tailwind utilities via `@theme inline`. Imported once into `apps/web/src/app/globals.css` via `@import "@vbph/config/tailwind-theme.css";` — every component consumes the semantic token (`bg-primary`, `text-muted-foreground`), never a raw brand hex.

### Brand → semantic mapping

| Semantic token | Value | Used for |
|---|---|---|
| `--primary` / `--primary-hover` | `#f5821f` / `#e06a00` (brand orange / deep orange) | Primary actions |
| `--primary-foreground` | `--brand-charcoal` (`#212224`) | Text on `--primary` — **not white**, see below |
| `--link` | `#8a3a0f` | Inline text links only — deliberately separate from `--primary` |
| `--secondary` | `#1f6b7d` (deepened teal) | Secondary surfaces (auth branded panel) |
| `--accent` | `#ffd400` (brand yellow) | Sparingly, decorative |
| `--destructive` / `--success` / `--warning` / `--info` | red / `#15803d` / amber / teal | Status semantics — shared by Badge, Alert, form validation |
| `--neutral-50…900` | Warm-biased gray scale | `--background`, `--border`, `--muted`, etc. all derive from this scale |
| `--shadow-xs/sm/md/lg` | Charcoal-tinted (`rgb(33 34 36 / α)`) | Card/Button/Modal elevation — not pure-black shadows |

Six `*-soft` / `*-soft-foreground` pairs (`primary`, `secondary`, `success`, `warning`, `destructive`, `info`) are near-white tints for Badge/Alert surfaces where the solid color would be too loud for a whole banner or pill. Each pair is a deliberately chosen, individually contrast-checked color — not a `bg-color/10` opacity blend (see below for why).

### Contrast fixes made in this pass

Every text/background pairing was verified by computing actual WCAG relative luminance (not eyeballed). Four real AA failures (4.5:1 normal text / 3:1 large text) were found in the pre-existing palette and fixed:

| Pairing | Before | After | Fix |
|---|---|---|---|
| White text on brand orange | ~2.61:1 | ~6.1:1 | `--primary-foreground` → dark charcoal, not white |
| White text on teal | ~3.76:1 | ~6.07:1 | `--secondary`/`--brand-teal` deepened `#2c8fa6` → `#1f6b7d` |
| White text on success green | ~3.30:1 | ~5.01:1 | `--success` deepened `#16a34a` → `#15803d` |
| `text-primary` used as the app-wide link color | ~2.61:1 | ~7.8:1 | New dedicated `--link: #8a3a0f` token; every `text-primary hover:underline` link site (~20 files) switched to `text-link hover:underline` |

The badge/alert `*-soft-foreground` colors exist for the same reason: a `bg-primary/10 text-primary` opacity blend measured as low as ~2.36:1 at badge text size. The soft tokens are flat, pre-mixed colors chosen to clear AA instead.

## Component library — `packages/ui`

| Component | Notes |
|---|---|
| `Button` | Variants `primary/secondary/outline/ghost/destructive`, sizes `sm/md/lg/icon`. `loading` prop swaps in `<Spinner>` + `aria-busy`, keeps width stable. |
| `Spinner` | Bare rotating-arc SVG; `label` prop only renders `sr-only` text when explicitly passed, to avoid double screen-reader announcements when nested in an already-labeled `Button`. |
| `Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` / `CardFooter` | `interactive` prop adds hover-lift for a Card that's itself a link target. |
| `Badge` | Variants `default/primary/secondary/success/warning/destructive/info`, all on soft tokens. `dot` prop adds a small colored status indicator (color is never the only signal — text label is always present alongside). |
| `Input` / `Textarea` / `Label` / `FieldMessage` | Shared focus/hover/`aria-invalid` styling. `FieldMessage` is a per-field helper/error text primitive (distinct from page-level `Alert`), documented for future per-field validation — not yet consumed since the app's forms currently return one form-level error per submission, not per-field. |
| `Select` | Adds a chevron icon; `className` applies to the **wrapper div**, not the inner `<select>`, so a caller's width utility doesn't detach the icon from a resized control. |
| `Avatar` | Photo (`alt={name}`) or initials fallback (`role="img" aria-label={name}`) — never unlabeled. |
| `Modal` | Base dialog: focus trap (Tab/Shift+Tab cycling), `aria-modal`, auto-wired `aria-labelledby` via `title` prop, Escape + backdrop-click to dismiss, restores focus to the previously-focused element on close. |
| `ConfirmDialog` | Built on `Modal`. Replaces every native `confirm()` call in the app (blocking, unstyled, and permanently suppressible via the browser's "prevent additional dialogs" checkbox). Manages its own `pending` state around an `onConfirm` callback that may return a `Promise`. |
| `Skeleton` | One `motion-safe:animate-pulse` div, `aria-hidden` — composed into whatever shape a given `loading.tsx` needs. |
| `EmptyState` | `icon` + `title` + `description` + `action`. The one "nothing here yet" pattern for the whole app — see below. |
| `Alert` | Variants `info/success/warning/destructive`, auto-selected icon, `role="alert"` for warning/destructive only (`role="status"` for info/success, so a non-urgent banner doesn't interrupt a screen reader's current position). |
| `Table` / `TableHeader` / `TableBody` / `TableFooter` / `TableRow` / `TableHead` / `TableCell` / `TableCaption` | Shared table primitives — see gotcha below. |

### A component API gotcha worth knowing before extending these

`Table`'s wrapper `<div class="overflow-x-auto rounded-lg border ...">` owns the border/rounding; the `className` prop is applied to the **inner `<table>`**, not the wrapper. Nesting `Table` inside a `Card`'s zero-padding `CardContent` produces a doubled border, and there's no `className` escape hatch for it (the wrapper's classes are hardcoded). The fix used throughout this pass: don't nest `Table` inside `Card` — use a plain `<div className="flex flex-col gap-3"><h2>…</h2><Table>…</Table></div>` instead, letting `Table`'s own border serve as the section boundary.

## Patterns

**Empty states.** Every list/table page that can be empty renders `<Card><EmptyState icon={...} title="..." description="..." action={...} /></Card>` — an icon for a quick visual read, a plain-language title, and an optional one-line explanation of *why* it's empty or what to do next (never bare "No data"). Applied to all 9 table pages plus every other hand-rolled `<Card><CardContent className="p-8 text-center">` block across the app (~20 pages), including three list pages — `admin/clients`, `admin/vas`, `admin/jobs` — that previously had no empty-state handling at all.

**Confirmation.** Every destructive/irreversible action (lock a timesheet, void an invoice, delete a screenshot) goes through `ConfirmDialog`, never `window.confirm()`.

**Tables.** All 9 raw `<table>` blocks across the three portals (admin timesheets/invoices/invoice-detail/compensation, client timesheets/invoices/invoice-detail/work-diary, VA compensation) use the shared `Table` primitives.

**Loading.** `loading.tsx` exists for all three portal dashboards (`admin/dashboard`, `client/dashboard`, `va/dashboard`), built from the shared `Skeleton` primitive and shaped to match each page's actual layout, not a generic placeholder.

**Navigation.** `DashboardShell` (Server Component) + `dashboard-nav.tsx` (Client Component, isolated so the rest of the shell never crosses the client boundary): desktop sidebar with `aria-current="page"` active-state highlighting, and a mobile drawer (previously the sidebar simply vanished below `sm` with no replacement) with its own focus trap, Escape-to-close, and body-scroll lock — same rigor as `Modal`.

## Accessibility

- **Skip link.** `DashboardShell` renders a `sr-only focus:not-sr-only` "Skip to content" link as the first focusable element, targeting `<main id="main-content" tabIndex={-1}>`.
- **Focus traps.** `Modal`, `ConfirmDialog` (via `Modal`), and the mobile nav drawer all trap Tab/Shift+Tab within the open dialog and restore focus to the triggering element on close.
- **Icon-only controls** always carry `aria-label` (menu trigger, close buttons, screenshot preview trigger); decorative icons alongside a visible text label carry `aria-hidden="true"`.
- **Toggle groups** (day/week view switch, skill filter chips) use `aria-pressed` plus a visible `focus-visible:ring`, not color alone, to convey selected state.
- **`prefers-reduced-motion`** respected throughout via Tailwind's `motion-safe:` variant — no transform/animation utility is applied unconditionally.
- **`role="alert"` vs `role="status"`** used deliberately (see `Alert` above) so non-urgent banners don't hijack screen-reader focus.

## Verification

`pnpm typecheck`, `pnpm lint`, and `pnpm build` all pass clean across the monorepo (`apps/web`, `apps/desktop`, `packages/*`) as of this pass.
