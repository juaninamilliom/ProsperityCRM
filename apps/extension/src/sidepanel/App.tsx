import { useEffect, useState } from 'react';
import {
  checkLinkedInMatch,
  fetchJobs,
  fetchMe,
  fetchStatuses,
  getStoredConfig,
  importCandidateToCRM,
  saveStoredConfig,
  type JobRequisition,
  type StatusConfig,
  type User,
} from './api';
import type { ParsedCandidateProfile } from '../content/linkedin-parser';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Settings State
  const [apiUrl, setApiUrl] = useState('https://prosperitycrm.onrender.com');
  const [token, setToken] = useState('');
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  // Tab & Candidate State
  const [activeUrl, setActiveUrl] = useState<string>('');
  const [extracting, setExtracting] = useState(false);
  const [profile, setProfile] = useState<ParsedCandidateProfile | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{ isDuplicate: boolean; person?: any }>({
    isDuplicate: false,
  });

  // Pipeline form
  const [jobs, setJobs] = useState<JobRequisition[]>([]);
  const [statuses, setStatuses] = useState<StatusConfig[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedStatusId, setSelectedStatusId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Initial load: config + user + active tab
  useEffect(() => {
    getStoredConfig().then((cfg) => {
      setApiUrl(cfg.apiUrl);
      setToken(cfg.token);

      if (cfg.token) {
        fetchMe()
          .then((res) => {
            setCurrentUser(res.dbUser);
            loadJobsAndStatuses();
          })
          .catch(() => {
            setCurrentUser(null);
          })
          .finally(() => setLoadingUser(false));
      } else {
        setLoadingUser(false);
        setShowSettings(true); // Prompt token setup if missing
      }
    });

    inspectActiveTab();
  }, []);

  // Listen for tab updates from background service worker
  useEffect(() => {
    const messageListener = (msg: any) => {
      if (msg.type === 'LINKEDIN_PAGE_CHANGED' || msg.type === 'LINKEDIN_PAGE_UPDATED') {
        inspectActiveTab();
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, []);

  async function loadJobsAndStatuses() {
    try {
      const [jobsData, statusesData] = await Promise.all([fetchJobs(), fetchStatuses()]);
      setJobs(jobsData.filter((j) => j.status === 'open'));
      setStatuses(statusesData.sort((a, b) => a.order_index - b.order_index));
      if (statusesData.length > 0) {
        setSelectedStatusId(statusesData[0].status_id);
      }
    } catch (err) {
      console.warn('Could not load jobs/statuses:', err);
    }
  }

  async function inspectActiveTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.id || !tab.url) return;

      setActiveUrl(tab.url);
      setImportSuccess(null);
      setImportError(null);

      if (!tab.url.includes('linkedin.com/in/')) {
        setProfile(null);
        return;
      }

      setExtracting(true);
      try {
        chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PROFILE' }, async (response) => {
          if (chrome.runtime.lastError || !response?.profile) {
            setProfile(null);
          } else {
            setProfile(response.profile);
            // Check for CRM duplicate
            if (response.profile.linkedin_url) {
              const match = await checkLinkedInMatch(response.profile.linkedin_url);
              setDuplicateInfo(match);
            }
          }
          setExtracting(false);
        });
      } catch {
        setExtracting(false);
      }
    });
  }

  async function handleSaveSettings() {
    await saveStoredConfig({ apiUrl, token });
    setSettingsMessage('Settings saved. Connecting…');
    try {
      const res = await fetchMe();
      setCurrentUser(res.dbUser);
      loadJobsAndStatuses();
      setSettingsMessage('Connected to Prosperity CRM!');
      setTimeout(() => {
        setShowSettings(false);
        setSettingsMessage(null);
      }, 1200);
    } catch {
      setSettingsMessage('Invalid API URL or Token. Please verify.');
    }
  }

  async function handleImport() {
    if (!profile || !profile.full_name) {
      setImportError('Candidate name is required.');
      return;
    }

    setImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      await importCandidateToCRM({
        full_name: profile.full_name,
        headline: profile.headline,
        current_title: profile.current_title,
        current_company: profile.current_company,
        location: profile.location,
        linkedin_url: profile.linkedin_url,
        skills: profile.skills,
        email: profile.email || undefined,
        phone: profile.phone || undefined,
        job_id: selectedJobId || undefined,
        status_id: selectedStatusId || undefined,
        notes: notes || undefined,
      });

      setImportSuccess(`Successfully imported ${profile.full_name} into Prosperity CRM!`);
      setDuplicateInfo({ isDuplicate: true });
    } catch (err: any) {
      setImportError(err.message || 'Failed to import candidate.');
    } finally {
      setImporting(false);
    }
  }

  const isLinkedInProfile = activeUrl.includes('linkedin.com/in/');

  return (
    <div className="flex min-h-screen flex-col bg-app text-ink">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-4 py-3 shadow-token">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-accent text-white shadow-sm">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 17l6-6 4 4 8-8" />
              <path d="M17 7h4v4" />
            </svg>
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight">Prosperity CRM</span>
            <span className="text-[11px] text-ink-3">LinkedIn Sourcing</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentUser && (
            <span className="hidden sm:inline-block rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-ink-2">
              {currentUser.name}
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="flex h-7 w-7 items-center justify-center rounded-control border border-border bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink transition"
            title="Settings & API Key"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* ─── Settings Drawer ────────────────────────────────────────────────── */}
      {showSettings && (
        <div className="border-b border-border bg-surface-2 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-2">
              Extension Connection
            </h2>
            <button
              onClick={() => setShowSettings(false)}
              className="text-xs text-ink-3 hover:text-ink"
            >
              ✕ Close
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-[11px] font-medium text-ink-2 mb-1">API URL</label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://prosperitycrm.onrender.com"
                className="w-full rounded-control border border-border bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-3"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-ink-2 mb-1">
                Auth Token (JWT or Login)
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your JWT token from Prosperity CRM"
                className="w-full rounded-control border border-border bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-3"
              />
            </div>

            {settingsMessage && (
              <p className="text-xs text-accent font-medium">{settingsMessage}</p>
            )}

            <button
              type="button"
              onClick={handleSaveSettings}
              className="w-full rounded-control bg-accent py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
            >
              Save & Verify
            </button>
          </div>
        </div>
      )}

      {/* ─── Main Content ──────────────────────────────────────────────────── */}
      <main className="flex-1 p-4 flex flex-col gap-4">
        {loadingUser ? (
          <div className="py-12 text-center text-xs text-ink-3">Connecting to workspace…</div>
        ) : !isLinkedInProfile ? (
          /* Empty / Prompt state when not on a profile */
          <div className="my-auto flex flex-col items-center gap-3 rounded-card border border-border bg-surface p-6 text-center shadow-token">
            <span className="text-3xl">🔍</span>
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold">Navigate to a LinkedIn Profile</h3>
              <p className="text-xs text-ink-3 max-w-[240px]">
                Open any candidate's profile page (e.g. <span className="font-mono text-accent">linkedin.com/in/...</span>) to capture details instantly.
              </p>
            </div>
            <button
              type="button"
              onClick={inspectActiveTab}
              className="mt-2 rounded-control border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-3 transition"
            >
              ↻ Refresh Tab
            </button>
          </div>
        ) : extracting ? (
          /* Parsing state */
          <div className="my-auto flex flex-col items-center gap-3 py-12 text-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-xs font-medium text-ink-2">Extracting profile data…</p>
          </div>
        ) : profile ? (
          /* Parsed Profile Form & Pipeline Card */
          <div className="flex flex-col gap-4">
            {/* Duplicate / New Banner */}
            {duplicateInfo.isDuplicate ? (
              <div className="flex items-center justify-between rounded-[8px] bg-ok-bg border border-ok-dot/20 p-2.5 text-xs text-ok-fg">
                <span className="font-semibold flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-ok-dot" />
                  Already in Prosperity CRM
                </span>
                {duplicateInfo.person?.person_id && (
                  <a
                    href={`${apiUrl.replace(/\/api$/, '')}/people/${duplicateInfo.person.person_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold underline hover:opacity-80"
                  >
                    View in CRM →
                  </a>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-[8px] bg-accent/10 border border-accent/20 p-2.5 text-xs text-accent-ink">
                <span className="h-2 w-2 rounded-full bg-accent" />
                <span className="font-semibold">New Candidate Ready to Import</span>
              </div>
            )}

            {/* Candidate Card Form */}
            <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-token">
              <div className="flex items-center gap-3">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    className="h-12 w-12 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white font-bold text-sm">
                    {profile.full_name.charAt(0) || 'C'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={profile.full_name}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    placeholder="Full name"
                    className="w-full text-sm font-semibold text-ink bg-transparent border-b border-transparent hover:border-border focus:border-accent outline-none"
                  />
                  <input
                    type="text"
                    value={profile.headline}
                    onChange={(e) => setProfile({ ...profile, headline: e.target.value })}
                    placeholder="Headline"
                    className="w-full text-xs text-ink-2 truncate bg-transparent border-b border-transparent hover:border-border focus:border-accent outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-ink-3">Title</label>
                  <input
                    type="text"
                    value={profile.current_title}
                    onChange={(e) => setProfile({ ...profile, current_title: e.target.value })}
                    placeholder="Job title"
                    className="w-full rounded-control border border-border bg-surface-2 px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-ink-3">Company</label>
                  <input
                    type="text"
                    value={profile.current_company}
                    onChange={(e) => setProfile({ ...profile, current_company: e.target.value })}
                    placeholder="Company"
                    className="w-full rounded-control border border-border bg-surface-2 px-2 py-1 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-semibold text-ink-3">Location</label>
                <input
                  type="text"
                  value={profile.location}
                  onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                  placeholder="Location"
                  className="w-full rounded-control border border-border bg-surface-2 px-2 py-1 text-xs"
                />
              </div>

              {/* Skills */}
              {profile.skills.length > 0 && (
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-ink-3 mb-1.5">
                    Skills ({profile.skills.length})
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {profile.skills.slice(0, 8).map((skill, i) => (
                      <span
                        key={i}
                        className="rounded-badge bg-surface-2 border border-border px-2 py-0.5 text-[10px] font-medium text-ink-2"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pipeline Assignment */}
            <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-token">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                Pipeline Sourcing
              </h3>

              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">
                  Assign to Job Requisition
                </label>
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="w-full rounded-control border border-border bg-surface px-2.5 py-1.5 text-xs text-ink"
                >
                  <option value="">-- No Job (Save to Database only) --</option>
                  {jobs.map((job) => (
                    <option key={job.job_id} value={job.job_id}>
                      {job.title} {job.company_name ? `(${job.company_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedJobId && (
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Initial Stage</label>
                  <select
                    value={selectedStatusId}
                    onChange={(e) => setSelectedStatusId(e.target.value)}
                    className="w-full rounded-control border border-border bg-surface px-2.5 py-1.5 text-xs text-ink"
                  >
                    {statuses.map((status) => (
                      <option key={status.status_id} value={status.status_id}>
                        {status.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Sourcing Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes on outreach, background, or alignment…"
                  className="w-full rounded-control border border-border bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-3"
                />
              </div>

              {importSuccess && (
                <p className="rounded-[8px] bg-ok-bg border border-ok-dot/20 p-2 text-xs text-ok-fg font-medium">
                  {importSuccess}
                </p>
              )}

              {importError && (
                <p className="rounded-[8px] bg-warn-bg p-2 text-xs text-warn-fg font-medium">
                  {importError}
                </p>
              )}

              <button
                type="button"
                onClick={handleImport}
                disabled={importing}
                className="w-full rounded-control bg-accent py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
              >
                {importing ? 'Importing candidate…' : 'Import to Prosperity CRM'}
              </button>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-ink-3">
            Could not extract candidate information from this page.
          </div>
        )}
      </main>
    </div>
  );
}
