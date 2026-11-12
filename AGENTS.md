# opamp-ui agent notes

Web console for `../opamp-backend`. Same stack and design tokens as `../zobp-ui` (React 19 / Vite 8 /
TypeScript 7 / Tailwind v4, `src/index.css` copied from there).

- Node 22 via Homebrew (keg-only): `export PATH=/opt/homebrew/opt/node@22/bin:$PATH`
- Verify with `npm run build` (`tsc -b` then Vite) and `npm run lint` (oxlint).
- Dev: `npm run dev` on :5174; `/api` is proxied to opamp-backend on :8080 (`OPAMP_BACKEND_URL` to override).
- tsconfig has `erasableSyntaxOnly`: no TS parameter properties / enums.
- Dependencies are pinned to exact versions; keep them pinned.
- Layout: `src/api-client` (typed fetch client + SSE), `src/auth`, `src/components`, `src/features/<feature>`.
