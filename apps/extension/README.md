# Prosperity CRM — LinkedIn Sourcing Chrome Extension

A Manifest V3 Chrome Extension that docks as a **Side Panel** while browsing candidate profiles on LinkedIn. It extracts candidate details via a hybrid parsing engine, checks for existing candidates in Prosperity CRM in real time, and allows 1-click import into active Job Requisitions and Pipeline Stages.

---

## Features

- **Chrome Side Panel (`chrome.sidePanel`)**: Stays open and sticky on the right as you navigate between candidate profiles.
- **Hybrid Extraction Engine**:
  - **JSON-LD Schema**: Extracts structured data from embedded Schema.org metadata.
  - **Hydration State / Voyager Blobs**: Extracts job titles, company names, skills, and dates from embedded JSON.
  - **Semantic DOM Heuristics**: Resilient fallback targeting standard profile headers and experience sections.
- **Real-Time CRM Matching**: Checks for duplicate candidates using normalized LinkedIn URLs.
- **1-Click Pipeline Sourcing**: Select an active Job Requisition and initial stage (e.g. `Sourced`, `Screening`) and save directly into the CRM.
- **Inline Editing**: Verify or tweak extracted data (name, headline, company, title, skills) before importing.

---

## Installation & Setup

### 1. Build the Extension
From the repository root:
```bash
npm run build --workspace @prosperity/extension
```
This produces the unpacked extension in `apps/extension/dist/`.

### 2. Load into Chrome
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** (top-left).
4. Select the directory:
   `<repo-root>/apps/extension/dist`
5. Pin the **Prosperity CRM** extension in your Chrome toolbar.

### 3. Connect to Your Workspace
1. Click the Prosperity CRM extension icon to open the Side Panel.
2. Click the ⚙️ (Settings) icon in the top right.
3. Confirm the API URL (`https://prosperitycrm.onrender.com` or `http://localhost:4000`).
4. Paste your Auth Token (copied from your web CRM session or login response).
5. Click **Save & Verify**.

---

## Sourcing Workflow

1. Navigate to any LinkedIn candidate profile (e.g. `https://www.linkedin.com/in/username`).
2. The Side Panel automatically parses the profile and checks if the candidate already exists in your workspace.
3. If new:
   - Review the candidate's name, company, title, and skills.
   - Choose a target **Job Requisition** and **Stage**.
   - Add any private sourcing notes.
   - Click **Import to Prosperity CRM**.
4. If already in CRM:
   - A banner displays with a 1-click link to view the candidate profile directly in Prosperity CRM.

---

## Development

- Start Vite in watch mode: `npm run dev --workspace @prosperity/extension`
- Run unit tests: `npm test --workspace @prosperity/extension`
- Check types: `npm run typecheck --workspace @prosperity/extension`
