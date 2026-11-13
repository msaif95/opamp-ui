# opamp-ui

Web console for [opamp-backend](../opamp-backend): fleet view, config editing, bulk pushes, groups, agent
credentials, audit log and system status. React, TypeScript, Vite and Tailwind.

## Run it locally

Needs Node 22 and a running backend (`make run` in `opamp-backend`).

```bash
npm ci
npm run dev        # http://localhost:5174, /api proxied to the backend on :8080
```

Sign in as `admin` / `admin` with the backend's development defaults. Set `OPAMP_BACKEND_URL` to proxy elsewhere.

## Check

```bash
npm run lint       # oxlint
npm test           # unit tests (vitest)
npm run build      # type-check and production build
```

## Container

```bash
docker build -t opamp-ui .
docker run -p 8080:8080 -e OPAMP_BACKEND_URL=http://backend:8080 opamp-ui
```

nginx (non-root, port 8080) serves the built console and proxies `/api` to `OPAMP_BACKEND_URL`. It sets a
Content-Security-Policy that allows scripts only from its own origin, so do not add inline scripts or third-party
script hosts without updating `docker/nginx.conf`. `/healthz` is the probe endpoint.

Serve the console over HTTPS only: sessions travel in the `Authorization` header and API keys are shown once in
the page.

## Layout

```
src/api-client     typed client for the backend API and the live event stream
src/auth           session handling, sign-in page
src/components     layout, branding, shared widgets
src/features/*     one folder per page
src/lib            small pure helpers, with tests
src/state          theme
docker/nginx.conf  production web server config
```

## Release

CI publishes `ghcr.io/<owner>/opamp-ui:sha-<commit>` from `main`; the `release` workflow publishes a versioned
image and tag.
