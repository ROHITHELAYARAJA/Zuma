# Clinical workspace

A bold clinical workspace for PS-013: reconcile fictional records from two hospitals, inspect source evidence and contradictions, ask questions, and review an export. The product name is deliberately undecided.

## Stack

- Next.js 16.4.1 App Router, React 19.3, TypeScript and Tailwind CSS 4 for the interface.
- Motion, GSAP and Three.js/React Three Fiber for motion and interactive presentation. The latest brand PDF defines white/ink surfaces with orange-red and yellow accents, Space Grotesk headings and DM Sans body text.
- Hono on Node.js 24 LTS for the API; SQLite for local workflow persistence.
- Explicit hospital format mappings, structured retrieval and local text relevance; a provenance graph connects records and conflicts.
- Optional Amazon Bedrock text and S3 adapters. AWS access is off by default.
- Vercel/Render templates and a proposed Supabase migration, neither deployed nor connected.

Exact installed dependency versions are recorded in the lockfile. This architecture keeps a working synthetic demonstration independent of cloud account setup.

## Start

```sh
npm install
npm run dev
```

Open `http://127.0.0.1:3000` for the product presentation, then `/workspace` for the functional clinical application. Use Node.js 24 or later. The API runs on port 8787 and the Next.js server proxies same-origin `/api` requests to it. The first run seeds fictional hospital data. Run `npm test`, `npm run typecheck` and `npm run build` for automated checks.

For a built local version, run `npm run build`, then `npm start` for the API and `npm run start:web` in another terminal for Next.js. `API_PROXY_TARGET` controls the server-side API origin and defaults to `http://127.0.0.1:8787`.

## Scope and limits

This is a synthetic-data prototype, not a production clinical system or certified ABDM integration. Demo actor switching is not authentication. Local HTTP/SQLite does not establish production encryption. Built-in FHIR checks cover the supported demo shapes, not full NRCeS certification. Browser speech support varies and is not Nova Sonic. The local answer engine is deterministic retrieval, not a connected foundation model.

See [architecture and diagrams](docs/architecture.md), [design brief](docs/design-brief.md), [deployment and optional integrations](docs/deployment.md), and [acceptance checklist](docs/verification.md). Optional cloud processing requires explicit operator configuration; no cloud resources are created by installation or startup.
