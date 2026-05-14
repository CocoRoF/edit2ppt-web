# edit2ppt-web — Plan

> **Status**: design draft. No code yet — read this first, push back on the trade-offs, then we start W0.

`edit2ppt-web` is a Next.js demo + production UI that lets a human exercise
the whole [edit2ppt](https://github.com/CocoRoF/edit2ppt) engine without
touching the API or MCP layer directly:

1. Pick a Korean PDF (or DOCX / PPTX / URL).
2. Paste your Anthropic key (BYOK).
3. Hit "Generate". Watch each pipeline stage stream in.
4. Preview the slides as they're produced.
5. Download the editable PPTX with the original Korean filename preserved.

It plugs into `hr_blog2.0` exactly like `edit2me` does: a separate repo,
a Dockerfile in `hr_blog2.0/edit2ppt-web/` that `git clone`s the
frontend at build time, nginx proxies `/edit2ppt/*` to the container.

---

## 1. High-level architecture

```
                        Browser  (https://hrletsgo.me/edit2ppt/)
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  hr_blog2.0 (existing compose)                                    │
│                                                                   │
│   nginx                                                           │
│     /edit2ppt/*           -> edit2ppt-web-frontend:3000           │
│     /edit2ppt-api/*       -> edit2ppt-server:8000  (REST)         │
│     /edit2ppt-mcp/*       -> edit2ppt-server:8000  (MCP HTTP+SSE) │
│                                                                   │
│   edit2ppt-web-frontend   Next.js 15, basePath /edit2ppt          │
│                           Calls /edit2ppt-api/* for everything.    │
│                                                                   │
│   edit2ppt-server         FastAPI + arq worker (single image).    │
│                           Reuses the existing Postgres + MinIO    │
│                           but with a separate `edit2ppt` database │
│                           and `edit2ppt` bucket.                  │
│                                                                   │
│   db (postgres)           shared. New database `edit2ppt`.        │
│   minio                   shared. New bucket `edit2ppt`.          │
│   redis  (NEW)            arq queue + JobBus pub/sub.             │
└──────────────────────────────────────────────────────────────────┘
```

Three new services in `docker-compose.dev.yml`:
- `edit2ppt-server` — FastAPI + arq worker (built from `CocoRoF/edit2ppt`)
- `edit2ppt-web-frontend` — Next.js (built from `CocoRoF/edit2ppt-web`)
- `redis` — new dependency (not used by existing services)

Two reused services:
- `db` — same Postgres, new database `edit2ppt` (init via SQL or via
  edit2ppt's Alembic on first boot)
- `minio` — same MinIO, new bucket `edit2ppt` (created on first boot
  via edit2ppt's bootstrap helper)

## 2. Why a separate repo

Same reasoning as Edit2me:

- The web UI evolves independently of the engine.
- The engine's tests and docs already live in `edit2ppt`; mixing the
  Next.js project in would balloon the engine's build surface.
- hr_blog2.0 can pin a specific `EDIT2PPT_WEB_REF` (commit / branch /
  tag) at compose build time, so deployments are reproducible and the
  blog can roll forward independently.

Repo: `CocoRoF/edit2ppt-web`.

## 3. Stack choices (matches Edit2me)

- Next.js 15.x (App Router) + React 19
- TypeScript
- Tailwind CSS (Edit2me uses it; consistent skill set)
- @aws-sdk/client-s3 — direct browser→MinIO uploads via presigned URL
  (offloads multipart from the frontend node process)
- shadcn/ui-style headless components (or plain Tailwind) — no heavy
  component lib

No backend in this repo. Every API route is a thin proxy to
`edit2ppt-server` over the docker network. The frontend never holds the
Anthropic key longer than the request that uses it.

## 4. URL surface

| Path | Purpose |
|---|---|
| `GET /edit2ppt/` | Home / demo intro |
| `GET /edit2ppt/generate` | Upload + form + live progress |
| `GET /edit2ppt/jobs/<id>` | Result view (preview + download) |
| `POST /edit2ppt/api/upload` | proxy → `POST /v1/assets` |
| `POST /edit2ppt/api/generate-deck` | proxy → `POST /v1/jobs/generate-deck` |
| `GET /edit2ppt/api/jobs/<id>` | proxy → `GET /v1/jobs/<id>` |
| `GET /edit2ppt/api/jobs/<id>/events` | proxy SSE → `GET /v1/jobs/<id>/events` |
| `GET /edit2ppt/api/assets/<id>/download` | proxy → `GET /v1/assets/<id>/download` (issues the presigned URL; frontend then 302-redirects the user to it) |
| `GET /edit2ppt/api/templates` | proxy → `GET /v1/templates` (M4.1 catalog) |

The proxy layer's only logic: forward `Authorization`, `Accept-Language`,
`X-Anthropic-API-Key` headers; preserve `Content-Disposition` on download
responses. No persistence in the Next.js side.

## 5. Screens

### 5.1 Home (`/edit2ppt/`)

- Brief Korean-first hero: "한국어 PDF를 PowerPoint로 — AI Agent도 사용 가능"
- Three quick links:
  - "지금 만들어보기" → `/edit2ppt/generate`
  - "MCP 연결 가이드" → `/edit2ppt/docs/mcp` (links to the engine's
    docs/mcp-clients.md)
  - "API 문서" → `/edit2ppt-api/docs` (FastAPI Swagger)
- Footer: engine version + commit (from `/edit2ppt-api/health`)

### 5.2 Generate (`/edit2ppt/generate`)

Three-column layout when wide enough; collapses to single column on
mobile.

Left — **Form**:
- Drag-and-drop file picker (PDF / DOCX / PPTX / XLSX / image)
  - Korean filenames preserved end-to-end (we just upload via the
    server's multipart, server stores `original_filename`).
- "Generate from URL" alternative (uses the engine's web_to_md path)
- User intent textarea ("이 자료로 어떤 발표를 만들지 한 문장")
- Options:
  - Language: ko-KR (default), en-US, zh-CN, ja-JP
  - Style: general / consultant / consultant-top
  - Pages: range slider (default 8–12)
  - Narration toggle (default off; when on, voice picker — loads
    `/edit2ppt-api/v1/tts-voices?lang=ko-KR`)
  - Image generation toggle (default off; requires OpenAI key field
    when on)
- BYOK fields:
  - Anthropic API key (required, password-style, session-only)
  - OpenAI image key (optional, only when image gen is enabled)
- "Generate" button

Middle — **Progress** (live):
- Stage timeline showing every `StageEvent` in real time
  - converting → strategizing → acquiring_images → executing_pages
    (one chip per page) → checking_quality → narrating → exporting
  - Each emits Korean strings via the i18n catalog
    (`Accept-Language: ko-KR`)
- Toggles "Show raw events" for SSE debug pane

Right — **Preview**:
- As each `page_done` event arrives, render the page-preview image
  (when M4 adds preview PNGs; until then placeholder)
- Final result section shows the downloaded `.pptx` thumbnail + button

### 5.3 Job (`/edit2ppt/jobs/<id>`)

Same layout as Generate's right column, plus:
- spec_lock collapsible viewer (YAML highlighted)
- design_spec markdown viewer
- Quality issues list (if any)
- Cost summary (tokens, image count, audio seconds, wall clock)
- Resume / regenerate buttons (when M2 adds regen API; placeholder
  until then)

### 5.4 Docs sub-pages

Light HTML pages that mirror `edit2ppt/docs/mcp-clients.md` and add the
URL examples specific to this host.

## 6. State management

- Job ID + Anthropic key live in `sessionStorage` (cleared on tab close).
- Active SSE connection is held in a React context so multiple
  components on Generate / Job share the same event stream.
- No long-term server-side session — every refresh re-fetches
  `/v1/jobs/<id>` and replays events from `?after_id=...`.

## 7. Korean filename round-trip (must-have)

- Upload: `<input type="file">` produces a `File` whose `.name` may be
  Korean. Pass through to the server's multipart body via the engine's
  existing `POST /v1/assets`.
- Download: backend returns a presigned MinIO URL with the encoded
  `Content-Disposition` already attached. The frontend `<a download>` or
  programmatic redirect honors the filename automatically.
- Verify in W2 with a Korean fixture file.

## 8. BYOK key handling (security)

- Anthropic key never persisted: held in React state for the duration
  of the form submit, sent as `X-Anthropic-API-Key` on the proxy hop,
  not stored anywhere on disk or in `sessionStorage` *after* the request
  completes (cleared in the response handler).
- The optional OpenAI key works the same way.
- Display a small "your key is never stored" line under both inputs.

## 9. Integration with hr_blog2.0

### 9.1 New files inside hr_blog2.0

- `hr_blog2.0/edit2ppt-web/Dockerfile.dev` — clones `edit2ppt-web` repo,
  npm install, next dev
- `hr_blog2.0/edit2ppt-web/Dockerfile` — production: clone + build +
  next start
- `hr_blog2.0/edit2ppt-web/README.md` — explains the build args and
  what env vars the compose injects
- `hr_blog2.0/edit2ppt-server/Dockerfile.dev` — clones `edit2ppt` repo,
  uv pip install, runs both `uvicorn` and `arq` via supervisor or two
  containers (decision below)
- `hr_blog2.0/edit2ppt-server/Dockerfile` — production version
- `hr_blog2.0/edit2ppt-server/README.md`

### 9.2 docker-compose.dev.yml additions

```yaml
  redis:
    container_name: new-web-redis-dev
    image: redis:7-alpine
    expose:
      - "6379"
    healthcheck: …
    restart: unless-stopped

  edit2ppt-server:
    container_name: new-web-edit2ppt-server-dev
    build:
      context: ./edit2ppt-server
      dockerfile: Dockerfile.dev
      args:
        EDIT2PPT_REF: ${EDIT2PPT_REF:-main}
    environment:
      - EDIT2PPT_DATABASE_URL=postgresql+asyncpg://newweb:newweb_dev@db:5432/edit2ppt
      - EDIT2PPT_REDIS_URL=redis://redis:6379/0
      - EDIT2PPT_S3_ENDPOINT_URL=http://minio:9000
      - EDIT2PPT_S3_ACCESS_KEY_ID=minioadmin
      - EDIT2PPT_S3_SECRET_ACCESS_KEY=minioadmin123
      - EDIT2PPT_S3_BUCKET=edit2ppt
      - EDIT2PPT_DEFAULT_LANG=ko-KR
      - EDIT2PPT_AUTH_DEV_API_KEY=${EDIT2PPT_AUTH_DEV_API_KEY:-dev-key-please-rotate}
    expose:
      - "8000"
    ports:
      - "58100:8000"   # direct access for debugging
    depends_on:
      db: { condition: service_healthy }
      redis: { condition: service_healthy }
      minio: { condition: service_healthy }

  edit2ppt-web-frontend:
    container_name: new-web-edit2ppt-web-dev
    build:
      context: ./edit2ppt-web
      dockerfile: Dockerfile.dev
      args:
        EDIT2PPT_WEB_REF: ${EDIT2PPT_WEB_REF:-main}
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_BASE_PATH=/edit2ppt
      - EDIT2PPT_SERVER_INTERNAL_URL=http://edit2ppt-server:8000
      - EDIT2PPT_SERVER_API_KEY=${EDIT2PPT_AUTH_DEV_API_KEY:-dev-key-please-rotate}
    expose:
      - "3000"
    ports:
      - "53002:3000"
    depends_on:
      edit2ppt-server: { condition: service_started }
```

### 9.3 nginx routes (additions to default.dev.conf)

```nginx
upstream edit2ppt_web   { server edit2ppt-web-frontend:3000; }
upstream edit2ppt_api   { server edit2ppt-server:8000; }

# /edit2ppt-api/* → FastAPI REST API (strip prefix)
location /edit2ppt-api/ {
    rewrite ^/edit2ppt-api/(.*)$ /$1 break;
    proxy_pass http://edit2ppt_api;
    # large uploads + SSE
    client_max_body_size 200m;
    proxy_request_buffering off;
    proxy_buffering off;
    proxy_read_timeout 3600s;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Connection "";
}

# /edit2ppt-mcp/* → MCP server (Streamable HTTP + SSE)
location /edit2ppt-mcp/ {
    rewrite ^/edit2ppt-mcp/(.*)$ /mcp/$1 break;
    proxy_pass http://edit2ppt_api;
    # match all the MCP / SSE settings
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_buffering off;
    proxy_read_timeout 3600s;
}

# /edit2ppt/* → Next.js frontend (must come AFTER the more specific
# /edit2ppt-api and /edit2ppt-mcp blocks)
location /edit2ppt {
    proxy_pass http://edit2ppt_web;
    # standard Next.js proxy config — match edit2me block
}
```

### 9.4 What if hr_blog2.0 already has redis?

Verify in W1. If yes, we reuse it; if no, we add the service. Either way
the env var `EDIT2PPT_REDIS_URL` is the only thing that needs to point
correctly.

## 10. Engine-side prep work

A few small additions to `CocoRoF/edit2ppt` make this web app
materially easier. None are blocking — we can ship W0/W1/W2 without
them — but we will want them before W3/W4 land:

- **Preview PNG generation** at the end of each Executor page so the
  frontend has something to render in real time. Currently the engine
  produces SVG only; the frontend can render the SVG directly as a fast
  path (browsers render SVG natively).
- **`/v1/jobs/<id>/events` Korean stage messages** — already supported
  via `Accept-Language`.
- **`/v1/templates`** — already shipped in M4.1's catalog. Just confirm
  the REST exposure (it's via MCP today; one tiny REST handler closes
  the gap).
- **CORS** — the frontend lives at the same origin as the API (both
  behind nginx), so no CORS needed for the demo. Skip until someone
  asks for cross-origin embedding.

I'll PR these in `CocoRoF/edit2ppt` between W2 and W3.

## 11. Milestones (PR plan)

| PR | Repo | Scope |
|----|------|-------|
| W0 | edit2ppt-web | Next.js 15 scaffold, basePath, layout, home page placeholder, lint + typecheck CI |
| W1 | hr_blog2.0 + edit2ppt-web | Dockerfile.dev for both new services, docker-compose entries, nginx routes, health-check smoke test |
| W2 | edit2ppt-web | Upload screen — file picker, Korean filename smoke test, calls `/api/upload` |
| W3 | edit2ppt-web | Generate screen — form, BYOK key fields, SSE live event stream |
| W4 | edit2ppt-web | Preview/Download screen — SVG preview, PPTX download with Korean filename |
| W5 | edit2ppt-web | Home page polish, docs sub-pages, screenshots, README |

(Engine side prep — preview PNG, `/v1/templates` REST — go in
between W2 and W3 as PRs in `CocoRoF/edit2ppt`.)

## 12. What to confirm before W0

1. **basePath `/edit2ppt`** OK? (Edit2me uses `/edit2me`; mirroring it.)
2. **Stack**: Next.js 15 + Tailwind acceptable, or do you want a
   different framework?
3. **Two new services in compose** OK? (`edit2ppt-server` and
   `edit2ppt-web-frontend`, plus `redis` if absent.) Or do you want a
   single combined container for simplicity?
4. **BYOK key in browser**: pasted per session in the UI vs server-side
   config. Plan defaults to per-session in browser; let me know if
   demo deployment should pre-fill from compose env so visitors don't
   need their own keys.
5. **edit2ppt server image — single container or two?** A FastAPI +
   arq worker can run as a single container (uvicorn + arq via
   honcho/foreman) or as two services. Plan defaults to single
   container (simpler; suits dev). Two services for production at M6
   when we get there.

Reply with answers to those five (or just "보낸 그대로 진행") and I'll
start W0.
