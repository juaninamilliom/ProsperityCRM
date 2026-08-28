# Prosperity CRM — LinkedIn Sourcing Chrome Extension

A Manifest V3 extension that docks as a **Side Panel** while you browse LinkedIn profiles. It reads the profile in the tab, checks whether the person is already in Prosperity, and imports or updates them — with an optional job requisition, starting stage and a sourcing note — in one click.

The panel is the web app in a 360px column: it imports the web app's design tokens and Tailwind theme (`apps/web/src/styles/tokens.css`, `apps/web/tailwind.config.ts`) and bundles the same fonts, so it never drifts from the app's look.

---

## Build & load

From the repository root:

```bash
npm run build --workspace @prosperity/extension     # → apps/extension/dist/
```

1. Open `chrome://extensions`, turn on **Developer mode**.
2. **Load unpacked** → select `apps/extension/dist`.
3. Pin **Prosperity CRM — LinkedIn Sourcing** and click its icon to open the side panel.

After pulling changes, rebuild and click the extension's **reload** icon on `chrome://extensions`. LinkedIn tabs that were already open keep last build's content script until the panel next reads them: the panel checks the script's protocol version on every read and injects the current one when it differs, so no tab refresh is needed.

`npm run package:extension` (repo root) builds and zips `dist/` into `prosperity-crm-extension.zip` for distribution.

## Signing in

The panel signs in the same way as the web app: Passkey / Touch ID first (opens a helper tab on the web app and closes it once signed in), a 1-click magic link second, password as a fallback. If you are already signed in to the web CRM in another tab, the panel picks that session up automatically. The token is kept in `chrome.storage.local`; **Log out** is in the account menu (your initials, top right).

## What gets extracted, and from where

Extraction runs in the LinkedIn tab (`src/content/linkedin-parser.ts`) and records a step-by-step **trace**, shown in the panel under *Extraction details* — copy it into a bug report when a profile parses badly.

LinkedIn serves **two profile layouts** and the parser handles both. The 2025 React layout (what most accounts see now — verified live on 2026-08-27) has hashed class names, `<section componentkey>` cards, the name in an `<h2>`, every text line in a `<p>`, and contact details in a `<dialog>`. The legacy Ember layout has `h1.text-heading-xlarge`, `#experience`, `pvs-*` classes and an artdeco modal. The trace's second line says which one was found.

| Field | Source, in priority order |
|---|---|
| Name, headline, location, photo | Top card (`h2` + `p` run in the 2025 layout; `h1`/`.text-body-*` in the legacy one) |
| Current title & company | The **top entry of the Experience stack** — nothing else, once it has rendered (grouped roles at one employer resolve to their top role; an ended top entry is flagged). Until it renders: the top-card badge for the company and a `"Title at Company"` headline guess for the title, marked as a placeholder in the panel and replaced as soon as Experience appears. Voyager entities (legacy layout) and Schema.org JSON-LD (public pages) fill in the same way. |
| Skills | The Skills card only — never the activity feed |
| Email, phone, websites | The **Contact info** overlay — see below |

If the top role has an end date, the panel says so rather than presenting it as current.

The 2025 layout renders the profile cards lazily, several seconds after the top card; the panel re-reads the tab once a second for up to twelve seconds, shows each improvement as it lands, and does not stop until the role has come from the Experience stack.

### Contact info

LinkedIn does not put email or phone in the profile DOM; they live behind the **Contact info** link. **Fetch contact info** in the panel tries, cheapest first:

1. read the overlay if it is already open;
2. *(legacy layout only)* fetch the overlay route and read the contact payload embedded in that page — the 2025 layout serves a 1 MB shell with no payload, so this step is skipped there;
3. click the link, wait for the overlay's rows, read them, dismiss it.

Outbound links are unwrapped from LinkedIn's `/safety/go?url=…` interstitial. Only data for the profile in the URL is accepted — the payload of a previously viewed profile is never reused.

## Development

```bash
npm run dev --workspace @prosperity/extension          # Vite dev server for the panel UI
npm test --workspace @prosperity/extension             # parser tests (jsdom fixtures of LinkedIn's DOM)
npm run typecheck --workspace @prosperity/extension
```

**Preview any panel state without Chrome APIs** — open the built or dev-served `sidepanel.html` with `?preview=<state>` where state is `login`, `empty`, `loading`, `failed`, `candidate` or `duplicate`; add `&theme=dark` for dark mode. This is how the design is checked in a plain browser tab or a headless one.

### Layout

```
apps/extension/
├── public/
│   ├── manifest.json            # MV3 permissions, side panel, content script
│   ├── fonts/                   # Instrument Sans / Serif (bundled; the panel must render offline)
│   └── icons/
├── src/
│   ├── background/service-worker.ts   # opens the panel on icon click; relays tab events
│   ├── content/
│   │   ├── content.ts           # EXTRACT_PROFILE / FETCH_CONTACT_INFO handlers, navigation notices
│   │   ├── linkedin-parser.ts   # pure extraction functions with trace
│   │   └── linkedin-parser.test.ts
│   └── sidepanel/
│       ├── App.tsx              # session, tab following, extraction orchestration, import
│       ├── AuthScreen.tsx       # sign-in (mirrors the web AuthPage)
│       ├── CandidatePanel.tsx   # candidate, contact and pipeline cards
│       ├── Shell.tsx            # header, empty/loading/failed states, trace panel
│       ├── extraction.ts        # tab messaging, content-script injection, retry
│       ├── ui.tsx               # the web app's ui primitives + icons
│       ├── theme.ts             # light/dark, persisted in chrome.storage
│       ├── preview.tsx          # ?preview= fixtures
│       ├── api.ts               # API client
│       └── index.css            # imports the web tokens; @font-face; base
├── sidepanel.html
├── tailwind.config.ts           # theme imported from apps/web
└── vite.config.ts               # panel build + IIFE bundles for content/service worker
```
