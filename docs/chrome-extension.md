# Chrome Extension Architecture & Integration Guide

The Prosperity CRM Chrome Extension (`@prosperity/extension`) empowers recruiters to source candidates directly from LinkedIn into Prosperity CRM with zero context switching.

> 📖 **Looking for the Recruiter User Guide & Installation instructions?** Check out the [Recruiter User Guide](./recruiter-user-guide.md).
> 📦 **To package the extension for distribution:** Run `npm run package:extension` to generate `prosperity-crm-extension.zip`.

---

## 1. Extension Architecture (Manifest V3)

```
apps/extension/
├── public/
│   ├── manifest.json            # Manifest V3 configuration & permissions
│   └── icons/                   # 16x16, 48x48, 128x128 icons
├── src/
│   ├── background/
│   │   └── service-worker.ts    # Side Panel behavior & tab event listener
│   ├── content/
│   │   ├── content.ts           # Content script injected on linkedin.com/*
│   │   ├── linkedin-parser.ts   # Hybrid multi-tier extractor engine
│   │   └── linkedin-parser.test.ts # Parser tests
│   └── sidepanel/
│       ├── main.tsx             # React entrypoint
│       ├── App.tsx              # Sourcing UI, deduplication, and pipeline assignment
│       ├── api.ts               # Authenticated API client
│       └── index.css            # Tailwind & Prosperity design tokens
├── sidepanel.html               # Side panel HTML root
└── vite.config.ts               # Multi-entry build configuration
```

---

## 2. Permissions & Security

| Permission | Purpose |
|------------|---------|
| `sidePanel` | Displays the persistent candidate sourcing panel on the right of the browser |
| `activeTab` | Inspects current active tab URL and DOM on LinkedIn |
| `tabs` | Detects tab navigation between LinkedIn candidate profiles |
| `storage` | Safely stores JWT token and API URL locally |
| `host_permissions` | Allows network calls to `https://www.linkedin.com/*` and Prosperity CRM API hosts |

---

## 3. Data Extraction Engine

Extraction runs locally in the content script using a 3-tier strategy:

1. **JSON-LD Schema (`<script type="application/ld+json">`)**:
   Reads standard Schema.org Person metadata.
2. **Hydration State / Voyager Blobs (`code[id^="bpr-guid-"]`)**:
   Parses raw hydration JSON embedded by LinkedIn to extract structured job history, company names, and skills list.
3. **Semantic DOM Heuristics**:
   Fallback selectors targeting top-card headers (`h1`), subtitle elements, location badges, and experience lists.

---

## 4. API Endpoints Used

- `GET /users/me` — Validates authentication and retrieves current recruiter info.
- `GET /people/lookup-linkedin?url=<url>` — Checks if a normalized LinkedIn URL is already stored.
- `GET /jobs` — Retrieves list of open Job Requisitions.
- `GET /statuses` — Retrieves configured pipeline stages.
- `POST /people` — Creates candidate record with source `'linkedin_capture'`.
- `POST /pipeline-entries` — Links candidate to selected Job Requisition and Stage.
