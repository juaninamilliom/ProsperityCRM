import { useEffect, useState } from 'react';
import {
  autoDetectWebSession,
  checkLinkedInMatch,
  clearAuthSession,
  fetchJobs,
  fetchMe,
  fetchStatuses,
  getAuthToken,
  importCandidateToCRM,
  launchPasskeyAuthBridge,
  loginWithPassword,
  requestMagicLink,
  verifyMagicLink,
  WEB_APP_URL,
  type JobRequisition,
  type StatusConfig,
  type User,
} from './api';
import type { ParsedCandidateProfile } from '../content/linkedin-parser';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Auth State
  const [authMethod, setAuthMethod] = useState<'passwordless' | 'password'>('passwordless');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [magicCode, setMagicCode] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

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

  // Initial load
  useEffect(() => {
    getAuthToken().then(async (token) => {
      let activeToken = token;
      // If no token in extension storage, attempt to auto-sync from web CRM tab
      if (!activeToken) {
        const detected = await autoDetectWebSession();
        if (detected) activeToken = detected;
      }

      if (activeToken) {
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

      const isProfile =
        tab.url.includes('linkedin.com/in/') ||
        tab.url.includes('linkedin.com/sales/lead/') ||
        tab.url.includes('linkedin.com/sales/people/') ||
        tab.url.includes('linkedin.com/talent/profile/');

      if (!isProfile) {
        setProfile(null);
        return;
      }

      setExtracting(true);
      try {
        chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PROFILE' }, async (response) => {
          if (!chrome.runtime.lastError && response?.profile && response.profile.full_name) {
            setProfile(response.profile);
            if (response.profile.linkedin_url) {
              const match = await checkLinkedInMatch(response.profile.linkedin_url);
              setDuplicateInfo(match);
            }
            setExtracting(false);
            return;
          }

          // Fallback: Programmatic executeScript on active tab directly
          try {
            const results = await chrome.scripting.executeScript({
              target: { tabId: tab.id! },
              func: () => {
                const h1 = document.querySelector('h1.text-heading-xlarge, section.artdeco-card h1, main h1, h1');
                const headlineEl = document.querySelector('.text-body-medium.break-words, div.pv-text-details__left-panel .text-body-medium, [data-anonymize="headline"]');
                const locEl = document.querySelector('.text-body-small.inline.t-black--light.break-words, span.text-body-small.inline, [data-anonymize="location"]');
                const avatarEl = document.querySelector('img.pv-top-card-profile-picture__image, img.presence-entity__image, img.pv-top-card__photo, img[alt*="photo of"]');
                
                let name = h1?.textContent?.trim() || '';
                if (!name && document.title) {
                  name = document.title.split(/[-–—|]/)[0]?.trim() || '';
                }
                const headline = headlineEl?.textContent?.trim() || '';
                const location = locEl?.textContent?.trim().replace(/Contact info/i, '').trim() || '';
                const avatar = (avatarEl as HTMLImageElement)?.src || null;

                let title = headline;
                let company = '';
                const parts = headline.split(/\s+(?:at|@)\s+/i);
                if (parts.length >= 2) {
                  title = parts[0].trim();
                  company = parts[1].split('|')[0].split('•')[0].trim();
                }

                return {
                  full_name: name,
                  headline,
                  current_title: title,
                  current_company: company,
                  location,
                  linkedin_url: window.location.href.split('?')[0].replace(/\/+$/, ''),
                  avatar_url: avatar && !avatar.includes('ghost-person') && !avatar.includes('data:image') ? avatar : null,
                  about: null,
                  skills: [],
                  email: null,
                  phone: null,
                };
              },
            });

            const parsed = results?.[0]?.result;
            if (parsed && parsed.full_name) {
              setProfile(parsed);
              if (parsed.linkedin_url) {
                const match = await checkLinkedInMatch(parsed.linkedin_url);
                setDuplicateInfo(match);
              }
            } else {
              setProfile(null);
            }
          } catch (e) {
            console.error('ExecuteScript failed:', e);
            setProfile(null);
          } finally {
            setExtracting(false);
          }
        });
      } catch {
        setExtracting(false);
      }
    });
  }

  // ─── Authentication Handlers ───────────────────────────────────────────────

  async function handlePasskeyLogin() {
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess('Opening Touch ID / Passkey authentication…');
    try {
      const token = await launchPasskeyAuthBridge();
      if (token) {
        const res = await fetchMe();
        setCurrentUser(res.dbUser);
        loadJobsAndStatuses();
        setAuthSuccess('Welcome back, ' + res.dbUser.name + '!');
      } else {
        setAuthError('Authentication was not completed.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Touch ID authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleMagicLinkRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!authEmail.trim()) {
      setAuthError('Please enter your email.');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      const res = await requestMagicLink(authEmail);
      setMagicSent(true);
      setAuthSuccess(res.message || 'Magic link sent! Check your email or paste the token below.');
    } catch (err: any) {
      setAuthError(err.message || 'Could not send magic link.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleMagicLinkVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!magicCode.trim()) {
      setAuthError('Please paste your sign-in code.');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await verifyMagicLink(magicCode);
      setCurrentUser(res.user);
      loadJobsAndStatuses();
      setAuthSuccess('Authenticated successfully!');
    } catch (err: any) {
      setAuthError(err.message || 'Invalid or expired magic link code.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword) {
      setAuthError('Email and password are required.');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await loginWithPassword(authEmail, authPassword);
      setCurrentUser(res.user);
      loadJobsAndStatuses();
    } catch (err: any) {
      setAuthError(err.message || 'Invalid email or password.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    await clearAuthSession();
    setCurrentUser(null);
    setAuthSuccess(null);
    setMagicSent(false);
  }

  // ─── Sourcing Handlers ─────────────────────────────────────────────────────

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

  const isLinkedInProfile =
    activeUrl.includes('linkedin.com/in/') ||
    activeUrl.includes('linkedin.com/sales/lead/') ||
    activeUrl.includes('linkedin.com/sales/people/') ||
    activeUrl.includes('linkedin.com/talent/profile/');

  return (
    <div className="flex min-h-screen flex-col bg-app text-ink">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-4 py-3 shadow-token">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-accent text-white shadow-sm font-bold text-xs">
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
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-ink-2">
                {currentUser.name}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-[11px] text-ink-3 hover:text-ink transition"
                title="Sign out"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ─── Main Content ──────────────────────────────────────────────────── */}
      <main className="flex-1 p-4 flex flex-col gap-4">
        {loadingUser ? (
          <div className="py-12 text-center text-xs text-ink-3 flex flex-col items-center gap-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span>Checking authentication…</span>
          </div>
        ) : !currentUser ? (
          /* ─── Seamless Login Screen (Passkeys, Magic Link, Password) ────── */
          <div className="my-auto flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-token">
            <div className="text-center">
              <h2 className="text-sm font-bold text-ink">Sign In to Prosperity CRM</h2>
              <p className="text-xs text-ink-3 mt-0.5">
                Authenticate to start sourcing candidates directly from LinkedIn.
              </p>
            </div>

            {/* Passkey 1-Click Button */}
            <button
              type="button"
              onClick={handlePasskeyLogin}
              disabled={authLoading}
              className="flex items-center justify-center gap-2 w-full rounded-control bg-accent py-2.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
            >
              <span>🍏</span>
              <span>{authLoading ? 'Verifying Touch ID…' : 'Sign in with Touch ID / Passkey'}</span>
            </button>

            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <span className="relative bg-surface px-2 text-[10px] uppercase font-semibold text-ink-3">
                Or with email
              </span>
            </div>

            {authMethod === 'passwordless' ? (
              /* Magic Link Flow */
              !magicSent ? (
                <form onSubmit={handleMagicLinkRequest} className="flex flex-col gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-ink-2 mb-1">
                      Work Email
                    </label>
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full rounded-control border border-border bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-accent"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full rounded-control border border-border bg-surface-2 py-2 text-xs font-semibold text-ink hover:bg-surface-3 transition disabled:opacity-50"
                  >
                    {authLoading ? 'Sending…' : '✉️ Send 1-Click Sign-In Link'}
                  </button>
                </form>
              ) : (
                /* Magic Code Verification Flow */
                <form onSubmit={handleMagicLinkVerify} className="flex flex-col gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-ink-2 mb-1">
                      Enter Sign-In Code or Token
                    </label>
                    <input
                      type="text"
                      required
                      value={magicCode}
                      onChange={(e) => setMagicCode(e.target.value)}
                      placeholder="Paste token or click link in email"
                      className="w-full rounded-control border border-border bg-surface px-3 py-2 text-xs text-ink font-mono"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="flex-1 rounded-control bg-accent py-2 text-xs font-semibold text-white transition hover:opacity-90"
                    >
                      Verify & Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => setMagicSent(false)}
                      className="rounded-control border border-border px-3 py-2 text-xs text-ink-2 hover:text-ink"
                    >
                      Back
                    </button>
                  </div>
                </form>
              )
            ) : (
              /* Password Fallback Flow */
              <form onSubmit={handlePasswordLogin} className="flex flex-col gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-ink-2 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-control border border-border bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-ink-2 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-control border border-border bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-accent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full rounded-control bg-accent py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {authLoading ? 'Signing in…' : 'Sign In with Password'}
                </button>
              </form>
            )}

            {/* Auth Method Toggle */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() =>
                  setAuthMethod(authMethod === 'passwordless' ? 'password' : 'passwordless')
                }
                className="text-[11px] text-accent font-medium hover:underline"
              >
                {authMethod === 'passwordless'
                  ? 'Use password instead'
                  : 'Use 1-Click Magic Link instead'}
              </button>
            </div>

            {/* Feedback Alerts */}
            {authError && (
              <p className="rounded-[8px] bg-warn-bg border border-warn-dot/20 p-2 text-xs text-warn-fg">
                {authError}
              </p>
            )}
            {authSuccess && (
              <p className="rounded-[8px] bg-ok-bg border border-ok-dot/20 p-2 text-xs text-ok-fg">
                {authSuccess}
              </p>
            )}
          </div>
        ) : !isLinkedInProfile ? (
          /* ─── Empty / Helper state when not on a profile ──────────────────── */
          <div className="my-auto flex flex-col items-center gap-3 rounded-card border border-border bg-surface p-6 text-center shadow-token">
            <span className="text-3xl">🔍</span>
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold">Navigate to a LinkedIn Profile</h3>
              <p className="text-xs text-ink-3 max-w-[240px]">
                Open any candidate's profile (e.g.{' '}
                <span className="font-mono text-accent">linkedin.com/in/...</span>) to capture
                details instantly.
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
          /* ─── Extracting Profile State ─────────────────────────────────────── */
          <div className="my-auto flex flex-col items-center gap-3 py-12 text-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-xs font-medium text-ink-2">Extracting profile data…</p>
          </div>
        ) : profile ? (
          /* ─── Candidate Form & Pipeline Sourcing ──────────────────────────── */
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
                    href={`${WEB_APP_URL}/people/${duplicateInfo.person.person_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold underline hover:opacity-80"
                  >
                    View in CRM →
                  </a>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-[8px] bg-accent-soft border border-accent/20 p-2.5 text-xs text-accent-ink">
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
