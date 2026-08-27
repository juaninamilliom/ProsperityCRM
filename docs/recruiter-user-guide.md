# Prosperity CRM — Recruiter User Guide 🚀

This guide explains how recruiters can install, authenticate, and use the **Prosperity CRM Chrome Extension** to source candidates directly from LinkedIn into your CRM pipeline with zero context switching.

---

## 📥 1. Installation Guide for Recruiters

### Option A: Install from the Packaged ZIP File (Easiest)
1. **Download / Receive the ZIP**:
   - Receive the `prosperity-crm-extension.zip` file (or build it with `npm run package:extension`).
2. **Unzip the File**:
   - Extract `prosperity-crm-extension.zip` into a folder on your computer (e.g. `~/Downloads/prosperity-crm-extension`).
3. **Load into Google Chrome**:
   - Open Google Chrome and navigate to: `chrome://extensions`
   - In the top-right corner, toggle **Developer mode** to **ON**.
   - Click the **Load unpacked** button in the top-left corner.
   - Select the extracted folder (`dist` or `prosperity-crm-extension`).
4. **Pin the Extension**:
   - Click the puzzle icon (🧩) in the Chrome toolbar and click the **Pin** (📌) icon next to **Prosperity CRM Sourcing**.

---

## 🔐 2. Authentication & Sign In

The extension supports the same passwordless authentication options as the Prosperity CRM web app:

1. **Open the Side Panel**:
   - Click the **Prosperity CRM** icon in your Chrome toolbar to open the side panel.
2. **Choose Your Sign-In Method**:
   - **🔑 Passkey (Touch ID / Face ID / Security Key)**: Click *"Sign in with Passkey"* for instant, biometric authentication.
   - **✨ Email Magic Link**: Enter your work email address and click *"Send Magic Link"*. Click the link in your inbox to be authenticated immediately.
3. **Verify Connection**:
   - Once logged in, your name, role, and the green connected dot will display in the header.

---

## 🎯 3. Sourcing Candidates from LinkedIn

1. **Navigate to Any LinkedIn Profile**:
   - Browse to any candidate profile on `linkedin.com/in/<username>`.
2. **Automatic Profile Extraction**:
   - The side panel automatically extracts the candidate's:
     - **Full Name**
     - **Current Job Title** (from their most recent Experience)
     - **Current Company**
     - **Location**
     - **Headline & Bio**
     - **Skills**
     - **Contact Info** (Email & Phone if available in their About section or contact card)
     - **Canonical LinkedIn URL**
3. **Edit / Refine Info**:
   - All fields are fully editable before saving.
4. **Select Pipeline Job & Stage**:
   - Choose an open **Job Requisition** (e.g. *"Senior Backend Engineer"*).
   - Select the initial pipeline **Stage** (e.g. *"Sourced"*, *"Screen"*, or *"Interview"*).
5. **Add Sourcing Notes**:
   - Write any initial observations or candidate fit notes in the **Sourcing Notes** box.
6. **Click "Import to Prosperity"**:
   - The candidate is created in Prosperity CRM.
   - The company is automatically linked or created as a prospect.
   - An activity note is logged with your timestamp.
   - The candidate is assigned to the selected Job Pipeline.

---

## 🔄 4. Updating Existing Candidates

When you navigate to a candidate who has **already been imported**:

1. **Automatic Detection**:
   - The extension detects the candidate by their LinkedIn URL and displays an **"Already in CRM"** badge with a link to their profile in Prosperity CRM.
2. **Pre-Populated Data**:
   - All existing details (`Current Title`, `Company`, `Location`, `Skills`, `Email`, `Phone`) are pre-populated into the extension fields.
3. **Update Info Button**:
   - The primary button changes to **"Update Info"**.
   - You can update their current position, add a new note, or attach them to an additional open Job Requisition.

---

## 💡 5. Best Practices for Recruiters

- **Keep the Side Panel Open**: You can leave the side panel open while browsing candidates on LinkedIn. It will automatically detect tab switches and URL changes.
- **Manual Refresh**: If LinkedIn hasn't finished loading when you opened the page, click the **↻ Refresh** button in the extension header.
- **External Links**: Click the **↗** icon next to the LinkedIn URL to test the canonical link.

---

## 🛠️ 6. Troubleshooting

- **"Could not extract candidate info"**: Click `↻ Refresh` in the header or ensure you are on a public `/in/<slug>` profile.
- **Session Expired**: If your token expires, click **"Sign In"** in the side panel to re-authenticate via Passkey or Magic Link.
