# opamp-ui

Web console for OpAMP Fleet. The full guide (development, deployment, features) is in the
[backend README](../opamp-backend/README.md); this file covers what is specific to the console.

## Develop

Needs Node 22 and a running backend (`make run` in `opamp-backend`).

```bash
npm ci
npm run dev        # http://localhost:5174, /api proxied to the backend on :8080
npm run lint       # oxlint
npm test           # unit tests (vitest)
npm run build      # type-check and production build
```

Sign in as `admin` / `admin` with the backend's development defaults. Set `OPAMP_BACKEND_URL` to proxy elsewhere.

## Container

```bash
docker build -t opamp-ui .
docker run -p 8080:8080 -e OPAMP_BACKEND_URL=http://backend:8080 opamp-ui
```

nginx (non-root, port 8080) serves the built console and proxies `/api` to `OPAMP_BACKEND_URL`. It sets a
Content-Security-Policy that allows scripts only from its own origin, so do not add inline scripts or third-party
script hosts without updating `docker/nginx.conf`. `/healthz` is the probe endpoint. Serve the console over HTTPS
only.

## Layout

```
src/api-client     typed client for the backend API and the live event stream
src/auth           session handling, sign-in page, per-project permissions
src/components     layout, sidebar, Select, dialogs, tabs and other shared pieces
src/features/*     one folder per page
src/lib            small pure helpers, with tests
docker/nginx.conf  production web server config
```

UI conventions (page header with one main action, forms in dialogs, shared dropdowns, tabs) are in `AGENTS.md`.
