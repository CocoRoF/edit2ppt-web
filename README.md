# edit2ppt-web

Korean-first web UI for the [edit2ppt](https://github.com/CocoRoF/edit2ppt) engine.
Served at `${basePath}` by [hr_blog2.0](https://github.com/CocoRoF/hr_blog2.0)
(default `/edit2ppt`). Mirrors the architecture of
[Edit2me](https://github.com/CocoRoF/Edit2me) so the blog's compose can
bring it up the same way.

| | |
|---|---|
| Stack | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS |
| basePath | `/edit2ppt` (override with `NEXT_PUBLIC_BASE_PATH`) |
| Health probe | `GET ${basePath}/api/health` |
| Engine | calls `http://edit2ppt-server:8000` over docker network |

## What it does

1. Upload a Korean PDF / DOCX / PPTX / XLSX.
2. Paste your Anthropic key (BYOK — never persisted).
3. Pick deck options (lang, style, page count, narration, image gen).
4. Watch each pipeline stage stream in (SSE).
5. Preview pages as they're produced.
6. Download the editable PPTX with the original Korean filename preserved.

Plus an MCP connection guide so AI Agents (Claude Desktop / Cursor) can
hit the same engine.

## Status

| Milestone | What works | What's coming |
|---|---|---|
| W0 (this commit) | Next.js scaffold, basePath wired, home + generate + docs placeholders, /api/health | — |
| W1 | — | hr_blog2.0 compose + nginx integration |
| W2 | — | Upload screen + Korean filename smoke test |
| W3 | — | Generate form + BYOK + SSE progress |
| W4 | — | Preview / Download |
| W5 | — | Polish + screenshots |

## Local dev (without hr_blog2.0)

```bash
cd frontend/src
npm install
NEXT_PUBLIC_BASE_PATH="" npm run dev
# → http://localhost:3000/
```

To run with the same basePath used in production:

```bash
NEXT_PUBLIC_BASE_PATH=/edit2ppt npm run dev
# → http://localhost:3000/edit2ppt
```

## Architecture

See [PLAN.md](./PLAN.md) for the full design — service topology, URL
surface, screens, Korean-filename round-trip, BYOK handling, and the
W0–W5 PR plan.

## License

[MIT](./LICENSE).

## Acknowledgments

Engine: [edit2ppt](https://github.com/CocoRoF/edit2ppt) (built on
[ppt-master](https://github.com/hugohe3/ppt-master), MIT).
Pattern: [Edit2me](https://github.com/CocoRoF/Edit2me).
