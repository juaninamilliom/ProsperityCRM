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
| `PING` | panel → tab | `{ ok, version }` — `content.js` is injected when there is no answer or the version is not the panel's (`PROTOCOL_VERSION` in `content/protocol.ts`; bump it when a response shape changes) |
| `EXTRACT_PROFILE` | panel → tab | `{ success, profile, trace }` |
| `FETCH_CONTACT_INFO` | panel → tab (async) | `{ success, contact: { email, phone, websites }, source, trace }` |
| `LINKEDIN_PAGE_CHANGED` | tab → panel | fired on SPA navigation |
| `PROFILE_UPDATED` | tab → panel | pushed (debounced) whenever the extraction result changes as LinkedIn renders the cards; the panel keeps the better of the two unless the recruiter has edited |
| `LINKEDIN_PAGE_UPDATED` | service worker → panel | fired on tab update / switch |

The panel re-reads a tab up to three times 700 ms apart because LinkedIn hydrates the top card before the experience section. Navigation events for the *same* profile (including the `/overlay/contact-info/` route) do not trigger a re-read once the profile is complete or the recruiter has edited a field.

## 4. Extraction engine

`extractProfile(document, url)` returns `{ profile, trace }`. The trace lists every decision ("Layout: 2025 profile", "Company "Meridian" (top-card badge)", "Experience: …") and is shown in the panel so a bad parse can be reported precisely.

Two layouts are supported. The **2025 layout** (verified live 2026-08-27): name in `main h2`, top-card text lines as sibling `<p>`s (degree, headline, a hidden "Company · School" summary, location, *Contact info* link), company/school badges as `[role="button"]`, experience entries as `[componentkey^="entity-collection-item-"]` under `[data-testid^="profile_ExperienceTopLevelSection"]` with `<p>Title</p><p>Company · Type</p><p>dates</p><p>location</p>`, a `<section>` per card found by its `<h2>` (About, Skills, Education), and the contact overlay as `<dialog data-testid="dialog">` with `<p>` label rows. The **legacy layout** keeps the earlier `h1`/`#experience`/`pvs-*` selectors.

Title and company, in priority order:

1. **Experience section** — the **top entry of the stack**, always: LinkedIn lists ongoing roles first, most recent first, so if the top entry has ended everything below it has too (the profile is flagged). Single roles and grouped roles (several positions at one employer) are told apart by where the date ranges sit; a `pvs-entity__sub-components` block alone is not a sign of grouping. The headline and the top-card badge are the member's own summary and never override it. `role_source` records where the title came from; the panel keeps re-reading until it is `'experience'` and labels anything else a placeholder.
2. **Top-card badge** — company only, while Experience has not rendered. Legacy: `button[aria-label="Current company: …"]`; 2025: the first `[role="button"]` badge unless it is a lone school. The *Education* badge is never used as a company.
3. **Voyager entities** in the page's `bpr-guid` payload blobs, scoped to the profile in the URL (blobs from the first-loaded profile outlive SPA navigation).
4. **Headline decomposition** — `"Title at Company"`, `"Title @ Company"`, `"Founder of Company"`; slogans yield nothing rather than a made-up title.
5. **Schema.org JSON-LD** — only present on logged-out public pages.

Contact info is not in the profile DOM. `FETCH_CONTACT_INFO` reads the open overlay; on the legacy layout it then tries fetching `/in/<slug>/overlay/contact-info/` and reading the contact payload from its embedded `datalet-bpr-guid` index (only the entry whose request names this slug); finally it clicks the *Contact info* link, waits for the overlay's rows, reads them (unwrapping `/safety/go?url=` link interstitials) and dismisses it. The 2025 layout skips the fetch step — its overlay route carries no payload.

The 2025 layout lazy-loads the profile cards; the panel re-reads up to twelve times a second apart and applies each improvement until the role has come from the Experience stack or the recruiter edits a field.

Tests (`linkedin-parser.test.ts`) run against jsdom fixtures of both layouts. The 2025 fixtures were built from the live DOM: top card with badges/pronouns/no-contact variants, single and grouped experience entries with description boxes, the Skills card next to an activity feed, About, and the contact dialog with website/email/phone rows.

## 5. API endpoints used

- `GET /users/me` — session check and recruiter identity.
- `GET /people/lookup-linkedin?url=<url>` — duplicate check by normalised LinkedIn URL.
- `GET /jobs`, `GET /statuses` — open requisitions and pipeline stages.
- `POST /people` / `PATCH /people/:id` — create or update, with `current_company` resolved to a company record server-side.
- `POST /activities` — the sourcing note.
- `POST /pipeline-entries` — attach to the chosen requisition and stage.
