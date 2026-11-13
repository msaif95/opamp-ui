# opamp-ui agent notes

Web console for `../opamp-backend`. Same stack as `../zobp-ui` (React 19 / Vite 8 / TypeScript 7 / Tailwind v4)
with its own theme.

- Node 22 via Homebrew (keg-only): `export PATH=/opt/homebrew/opt/node@22/bin:$PATH`
- Verify with `npm run build` (`tsc -b` then Vite), `npm run lint` (oxlint) and `npm test` (vitest; pure helpers in `src/lib`).
- Dev: `npm run dev` on :5174; `/api` is proxied to opamp-backend on :8080 (`OPAMP_BACKEND_URL` to override).
- tsconfig has `erasableSyntaxOnly`: no TS parameter properties / enums.
- Dependencies are pinned to exact versions; keep them pinned.
- Layout: `src/api-client` (typed fetch client + SSE), `src/auth`, `src/components`, `src/features/<feature>`.
- Theme: semantic tokens in `src/index.css` (`--c-*` -> Tailwind colours `bg-panel`, `text-muted`, `text-accent`, ...),
  light by default and `.dark` on `<html>`. Never use raw colours in components. Mode (light/dark/system) lives in
  `src/state/ThemeContext.tsx`, persisted as `opamp.theme`; the inline script in `index.html` applies it before
  first paint and must stay in sync. Logo, wordmark and theme switch are in `src/components/Brand.tsx`.
- In dark mode `accent` is light, so text on accent/danger backgrounds must use `text-accent-fg` / `text-danger-fg`,
  not `text-white`.
- Container: `docker build -t opamp-ui .`; nginx (unprivileged, :8080) serves `dist` and proxies `/api` to
  `OPAMP_BACKEND_URL`.
- The production CSP (`docker/nginx.conf`) forbids inline scripts: the theme bootstrap is `public/theme-init.js`,
  not an inline `<script>`. Keep it that way.
- Config builder: `src/features/config-builder`. Forms are generated from the backend catalog; add component
  types in the backend, not here.
- Dropdowns and dialogs: never use the browser's `<select>`, `confirm()` or `prompt()`. Use `components/Select`
  (Radix select; `''` is a valid option value), `confirmDialog` / `promptDialog` from `lib/dialog` (rendered by
  `<DialogHost />` in `App.tsx`), and `components/Dialogs` `Modal` for small forms. Tooltips use Radix tooltip.
- Sidebar (`components/Layout.tsx`) collapses to icons; the choice is kept in `localStorage`. Everyday pages go in
  `NAV`, administrator pages in `ADMIN_NAV` (the click-to-expand Admin group; a click menu when collapsed). Use
  `Link` with a string `className` there, not `NavLink` with a function: Radix `asChild` stringifies the function.
- Project access in the UI: `useAuth().canIn(projectId, role)` for a resource, `can(role)` for "anywhere",
  `components/ProjectSelect` for create forms. The Users page (`features/users`) lists people and their projects.
- Page layout convention: every list page starts with `PageHeader` (title, one-line description, main action on the
  right as a primary button) followed by the table. Creating or editing something small opens a `Modal` with the
  form (Cancel + primary button, right-aligned); never put a create form inline under a table. Full-page forms are
  only for the large ones (config editor/builder, new bulk push, add collectors). Secrets shown once use `SecretOnce`.
- Pages holding several kinds of thing use `components/Tabs` (open tab kept in `?tab=`; see `features/credentials`
  and the agent page's Overview/Activity):
  one `PageHeader`, then per tab a `TabIntro` (what it is + its main action) and one table.
- Fleet filters are linked: a group belongs to one project, so picking a group sets the project filter, picking a
  project limits the group list and clears a group from another project, and the summary cards take both.
- Notifications: `toast()` from `lib/toast` (rendered by `<ToastHost />`). `components/Notifier` raises them by
  comparing each poll of rollouts, the summary and (admins) alerts with the previous one; collectors are announced
  as counts, never one by one. The SSE stream carries no detail, by design.
- Navigation aids: `Breadcrumbs` on every page below a list; `EmptyState` in place of an empty table; global search
  (`SearchPalette`, `/` or Ctrl/Cmd+K); shortcuts in `lib/shortcuts.ts` (add new pages to `GO_TO`), which stay off
  while focus is in a field, dialog, menu or listbox.
- The fleet page reads its initial filters from the address (`?view=`, `?attr=k=v`, `?q=`, `?group=`, `?project=`);
  link to it that way from other pages.
- Accessibility: run axe over every page in both themes before finishing UI work (script kept outside the repo; it
  logs in, visits each route, opens the search, help and a form dialog). The baseline is zero violations for WCAG
  2.x A/AA and best practices. Token colours in `index.css` were tuned for 4.5:1 on badges; check contrast when
  changing them. Table header cells need text (use `sr-only`), charts inside links need `accessibilityLayer={false}`.
- The event stream is closed on `pagehide`: browsers allow six connections per host, and pages kept in the
  back/forward cache otherwise hold theirs until new pages hang.
