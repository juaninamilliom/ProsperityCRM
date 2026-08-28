# Chrome Extension Architecture & Integration Guide

The Prosperity CRM Chrome Extension (`@prosperity/extension`) lets recruiters source candidates from LinkedIn into Prosperity CRM without leaving the profile they are reading.

> 📖 **Recruiter install and usage instructions:** [Recruiter User Guide](./recruiter-user-guide.md).
> 📦 **Package for distribution:** `npm run package:extension` → `prosperity-crm-extension.zip`.
> 🛠 **Developer README:** [`apps/extension/README.md`](../apps/extension/README.md).

---

## 1. Architecture (Manifest V3)

```
apps/extension/
├── public/manifest.json         # permissions, side panel, content script, bundled fonts/icons
├── src/background/service-worker.ts   # opens the panel on icon click; relays tab events
├── src/content/
│   ├── content.ts               # message handlers in the LinkedIn tab
│   └── linkedin-parser.ts       # extraction (pure functions over a Document, with trace)
└── src/sidepanel/               # React panel: App, AuthScreen, CandidatePanel, Shell, ui, theme
```

The panel is styled with the web app's own tokens and Tailwind theme, imported from `apps/web` rather than copied, and bundles Instrument Sans / Instrument Serif so it renders identically offline.

## 2. Permissions

| Permission | Purpose |
|------------|---------|
| `sidePanel` | The docked sourcing panel |
| `tabs`, `activeTab` | Follow the recruiter across LinkedIn tabs and SPA navigations |
| `scripting` | Inject `content.js` into tabs that were open before the extension was installed or reloaded |
| `storage` | JWT and theme choice |
| `cookies` + web app host | Pick up an existing web CRM session |
| `host_permissions` | `linkedin.com` (extraction), the API host, the web app |

## 3. Messages between panel and tab

| Message | Direction | Response |
|---|---|---|
| `PING` | panel → tab | `{ ok }` — used to decide whether `content.js` must be injected |
| `EXTRACT_PROFILE` | panel → tab | `{ success, profile, trace }` |
| `FETCH_CONTACT_INFO` | panel → tab (async) | `{ success, contact: { email, phone, websites }, source, trace }` |
| `LINKEDIN_PAGE_CHANGED` | tab → panel | fired on SPA navigation |
| `LINKEDIN_PAGE_UPDATED` | service worker → panel | fired on tab update / switch |

The panel re-reads a tab up to three times 700 ms apart because LinkedIn hydrates the top card before the experience section. Navigation events for the *same* profile (including the `/overlay/contact-info/` route) do not trigger a re-read once the profile is complete or the recruiter has edited a field.

## 4. Extraction engine

`extractProfile(document, url)` returns `{ profile, trace }`. The trace lists every decision ("Company "Meridian" (top-card badge)", "Experience: …") and is shown in the panel so a bad parse can be reported precisely.

Title and company, in priority order:

1. **Experience section** — the most recent *ongoing* role. Single roles and grouped roles (several positions at one employer) are told apart by where the date range sits; a `pvs-entity__sub-components` block alone is not a sign of grouping (single roles have one for the description and skills line). When a top-card *Current company* badge exists, the ongoing role at that company wins.
2. **Top-card badge** — parsed from `button[aria-label="Current company: …"]`. The *Education* badge in the same list is never used as a company.
3. **Voyager entities** in the page's `bpr-guid` payload blobs, scoped to the profile in the URL (blobs from the first-loaded profile outlive SPA navigation).
4. **Headline decomposition** — `"Title at Company"`, `"Title @ Company"`, `"Founder of Company"`; slogans yield nothing rather than a made-up title.
5. **Schema.org JSON-LD** — only present on logged-out public pages.

Contact info is not in the profile DOM. `FETCH_CONTACT_INFO` reads the open overlay, else fetches `/in/<slug>/overlay/contact-info/` and reads the contact payload from its embedded `datalet-bpr-guid` index (only the entry whose request names this slug), else clicks the *Contact info* link, reads the rendered overlay and dismisses it.

Tests (`linkedin-parser.test.ts`) run against jsdom fixtures that mirror LinkedIn's logged-in markup: hashed layout classes, `aria-hidden` / `visually-hidden` text pairs, aria-label badges, grouped experience entries and the contact overlay.

## 5. API endpoints used

- `GET /users/me` — session check and recruiter identity.
- `GET /people/lookup-linkedin?url=<url>` — duplicate check by normalised LinkedIn URL.
- `GET /jobs`, `GET /statuses` — open requisitions and pipeline stages.
- `POST /people` / `PATCH /people/:id` — create or update, with `current_company` resolved to a company record server-side.
- `POST /activities` — the sourcing note.
- `POST /pipeline-entries` — attach to the chosen requisition and stage.
