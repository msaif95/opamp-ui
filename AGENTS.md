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
