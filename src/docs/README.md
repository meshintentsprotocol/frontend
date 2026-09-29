# Developer docs (`/docs`)

Self-contained docs site mounted at `/docs/*` (lazy-loaded from `App.tsx`).

```
src/docs/
├── DocsApp.tsx          routes, layout, ⌘K / "/" search hotkeys
├── nav.ts               THE site structure: header tabs → sidebar groups → pages
├── embeds.tsx           registry of named diagrams and charts usable from markdown
├── content/**.md        one file per page; path = slug
├── lib/content.ts       loads markdown, parses frontmatter, builds TOC + search index
├── lib/remark.ts        heading ids, GitHub-style callouts
├── components/          header, sidebar, TOC, search, markdown renderer, blocks
├── diagrams/            hand-built diagrams (React + Tailwind / SVG)
├── charts/              interactive charts (Recharts)
└── pages/               DocsHome, DocsPage
```

## Screenshots

Screenshots are uploaded by hand to `public/docs/screenshots/`. Until a file
exists, its slot renders a dashed "Screenshot slot" frame showing the exact path
to upload. PNG at 1440 × 900 (dark theme) is recommended.

| File | Capture | Used on |
| --- | --- | --- |
| `trade-swap.png` | `/trade`, Swap tab | Docs home, How a swap works |
| `trade-limit.png` | `/trade`, Limit tab | Limit orders |
| `trade-twap.png` | `/twap` | TWAP orders |
| `order-tracker.png` | `/trade`, order tracker with an active intent | Intent lifecycle |
| `refund-state.png` | `/trade`, an expired → refunded intent | Refunds & cancellation |
| `mesh-pools.png` | `/mesh` | Docs home, Mesh overview |
| `mesh-create-pool.png` | `/mesh`, create-pool form | Pool lifecycle |
| `orderbook.png` | `/orderbook` | Docs home, Tri-route engine, Orderbook API |
| `admin-routes.png` | `/admin`, route controls | Admin & route controls |

To add a new slot anywhere, use a `screenshot` block (or `![alt](/docs/screenshots/x.png "caption")`)
and add the file to this table.

## Add a page

1. Add a leaf to `nav.ts`: `{ slug: 'mesh/pools/new-thing', title: 'New thing' }`.
   Optional: `badge: 'new' | 'beta' | 'soon'`, `method: 'GET' | 'POST' | 'WS'` (API pages).
   Groups nest to any depth; `collapsed: true` starts a group closed.
2. Create `content/mesh/pools/new-thing.md`:

```md
---
title: New thing
description: One sentence shown under the title and in search.
status: ready            # ready | draft | planned
updated: 2026-09-28
sources: MeshDocs/xyz.md, BCHMesh/meshserver/src/foo.ts
---

Body…
```

A nav leaf with no file renders an automatic "planned" page. A file not in
`nav.ts` logs a warning in dev. `status` drives the sidebar dot, the banner
and the coverage bars on the docs home.

## Markdown features

Standard GFM (tables, task lists, strikethrough) plus:

| Syntax | Renders |
| --- | --- |
| `> [!NOTE]` / `[!TIP]` / `[!INFO]` / `[!WARNING]` / `[!DANGER]` + optional title | Callout |
| ` ```ts title="file.ts" {2,5-7} ` | Code block with filename and highlighted lines |
| ` ```codegroup ` with `@@ Label \| lang` sections | Tabbed code |
| ` ```mermaid title="caption" ` | Mermaid diagram (themed, lazy-loaded) |
| ` ```diagram <name> ` | Registered React diagram (see `embeds.tsx`) |
| ` ```chart <name> ` | Registered interactive chart |
| ` ```endpoint ` + JSON | API reference block with generated cURL/TS and response tabs |
| ` ```cards ` + JSON `[{title, description, href, icon}]` | Link card grid (`cols=3` in meta for three columns) |
| ` ```screenshot ` + JSON `{src, url, caption}` or `![alt](src "caption")` | Framed, zoomable screenshot (upload slot until the file exists) |

Links: `[text](intents/overview)` goes to `/docs/intents/overview`; `/trade` stays
an app route; `http(s)` opens a new tab.

### Endpoint JSON

```json
{
  "method": "POST",
  "path": "/api/v1/quote",
  "auth": "none",
  "summary": "…",
  "params": [{ "name": "amountIn", "in": "body", "type": "string", "required": true, "description": "…", "example": "10" }],
  "body": { "amountIn": "10" },
  "responses": [{ "status": 200, "description": "…", "body": {} }]
}
```

`in` is `path | query | header | body`. Path params with an `example` are filled
into the generated snippets. `"auth": "admin"` adds the `x-admin-key` header.

## Add a diagram or chart

1. Build the component in `diagrams/` (use `Figure`, `Node`, `Tag`, `FlowArrow` from
   `diagrams/primitives.tsx`) or `charts/` (use `ChartFrame`, `SERIES`, `LegendItem`).
2. Register it in `embeds.tsx`.
3. Use it: ` ```diagram my-diagram ` / ` ```chart my-chart `.

Chart colors come from `SERIES` in `charts/ChartFrame.tsx`, a categorical palette
validated for colour-vision deficiency on the docs surface. Assign slots in order.

## Style rules for content

- Write from the code, not from memory: cite the files in `sources`.
- Amounts are integer strings in base units; BCH is `0x` in requests.
- Mark beta features as beta and say what isn't cleared for mainnet.
- Don't publish operational secrets, private endpoints or unpatched vulnerability details.
