import { useCallback, useEffect, useRef, useState } from 'react';
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
  type CandidateDuplicateResult,
  type JobRequisition,
  type StatusConfig,
  type User,
} from './api';
import { isLinkedInProfileUrl, normalizeLinkedInUrl, type ParsedCandidateProfile } from '../content/linkedin-parser';
import { AuthScreen } from './AuthScreen';
import { CandidatePanel, type ContactState } from './CandidatePanel';
import { activeTab, extractWithRetry, fetchContactFromTab, hasExperienceRole } from './extraction';
import { EmptyState, FailureState, LoadingState, Shell } from './Shell';
import { useTheme } from './theme';
import { Button } from './ui';

type Phase =
  | { kind: 'idle' }
  | { kind: 'extracting'; url: string }
  | { kind: 'failed'; url: string; trace: string[] }
  | { kind: 'ready'; url: string; profile: ParsedCandidateProfile; trace: string[]; duplicate: CandidateDuplicateResult; dirty: boolean };


/** Existing CRM data fills whatever the page did not give us. */
function mergeExisting(profile: ParsedCandidateProfile, match: CandidateDuplicateResult): ParsedCandidateProfile {
  const person = match.person;
  if (!match.isDuplicate || !person) return profile;
  return {
    ...profile,
    full_name: profile.full_name || person.full_name || '',
    headline: profile.headline || person.headline || '',
    current_title: profile.current_title || person.current_title || '',
    current_company: profile.current_company || person.company_name || '',
    location: profile.location || person.location || '',
    email: profile.email || person.email || null,
    phone: profile.phone || person.phone || null,
    skills: profile.skills.length > 0 ? profile.skills : person.skills ?? [],
  };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function App() {
  const [theme, toggleTheme] = useTheme();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const inspectToken = useRef(0);
  const busy = useRef(false);

  const [contact, setContact] = useState<ContactState>({ status: 'idle' });

  const [jobs, setJobs] = useState<JobRequisition[]>([]);
  const [statuses, setStatuses] = useState<StatusConfig[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedStatusId, setSelectedStatusId] = useState('');
  const [notes, setNotes] = useState('');
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const loadJobsAndStatuses = useCallback(async () => {
    try {
      const [jobsData, statusesData] = await Promise.all([fetchJobs(), fetchStatuses()]);
      setJobs(jobsData.filter((job) => job.status === 'open'));
      const ordered = [...statusesData].sort((a, b) => a.order_index - b.order_index);
      setStatuses(ordered);
      if (ordered.length > 0) setSelectedStatusId((current) => current || ordered[0].status_id);
    } catch (error) {
      console.warn('Could not load jobs/statuses:', error);
    }
  }, []);

  const inspectActiveTab = useCallback(async (force = false) => {
    if (busy.current) return;
    const tab = await activeTab();
    if (!tab?.id || !tab.url) return;

    if (!isLinkedInProfileUrl(tab.url)) {
      inspectToken.current += 1;
      setPhase({ kind: 'idle' });
      return;
    }

    const url = normalizeLinkedInUrl(tab.url);
    const current = phaseRef.current;
    const sameProfile = current.kind !== 'idle' && current.url === url;
    if (!force && sameProfile) {
      // The overlay routes (/overlay/contact-info/) and LinkedIn's own
      // re-renders fire navigation events for the same person. Re-read only
      // when the first read was incomplete and the recruiter has not edited.
      if (current.kind === 'extracting') return;
      if (current.kind === 'ready' && (current.dirty || hasExperienceRole(current.profile))) return;
    }

    const token = ++inspectToken.current;
    setPhase({ kind: 'extracting', url });
    setContact({ status: 'idle' });
    setImportSuccess(null);
    setImportError(null);

    // The CRM lookup only needs the URL, so it runs alongside the page reads;
    // each improved read replaces the profile unless the recruiter has typed.
    let duplicate: CandidateDuplicateResult | null = null;
    const lookup = checkLinkedInMatch(url).then((match) => {
      duplicate = match;
      return match;
    });
    const apply = (result: { profile: ParsedCandidateProfile | null; trace: string[] }) => {
      if (token !== inspectToken.current || !result.profile) return;
      const profile = result.profile;
      setPhase((current) => {
        if (current.kind === 'ready' && current.url === url && current.dirty) return current;
        const match = duplicate ?? { isDuplicate: false };
        return { kind: 'ready', url, profile: mergeExisting(profile, match), trace: result.trace, duplicate: match, dirty: false };
      });
    };

    try {
      const result = await extractWithRetry(tab.id, 12, 1000, apply);
      await lookup.catch(() => null);
      if (token !== inspectToken.current) return;
      if (!result.profile) {
        setPhase({ kind: 'failed', url, trace: result.trace });
        return;
      }
      apply(result);
    } catch (error) {
      if (token !== inspectToken.current) return;
      setPhase({ kind: 'failed', url, trace: [errorMessage(error, 'Extraction failed')] });
    }
  }, []);

  // Session bootstrap: extension storage first, then a logged-in web app tab.
  useEffect(() => {
    getAuthToken().then(async (stored) => {
      const token = stored || (await autoDetectWebSession());
      if (!token) {
        setLoadingUser(false);
        return;
      }
      try {
        const me = await fetchMe();
        setCurrentUser(me.dbUser);
        loadJobsAndStatuses();
      } catch {
        setCurrentUser(null);
      } finally {
        setLoadingUser(false);
      }
    });
    inspectActiveTab();
  }, [inspectActiveTab, loadJobsAndStatuses]);

  // Follow the recruiter across tabs and SPA navigations.
  useEffect(() => {
    const onMessage = (message: { type?: string }) => {
      if (message?.type === 'LINKEDIN_PAGE_CHANGED' || message?.type === 'LINKEDIN_PAGE_UPDATED') inspectActiveTab();
    };
    const onActivated = () => inspectActiveTab();
    const onUpdated = (_tabId: number, change: chrome.tabs.TabChangeInfo) => {
      if (change.url || change.status === 'complete') inspectActiveTab();
    };
    const onFocus = () => inspectActiveTab();

    chrome.runtime.onMessage.addListener(onMessage);
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    window.addEventListener('focus', onFocus);
    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      window.removeEventListener('focus', onFocus);
    };
  }, [inspectActiveTab]);

  /* ─── Auth ──────────────────────────────────────────────────────────────── */

  async function finishLogin(user: User, message: string | null = null) {
    setCurrentUser(user);
    setAuthSuccess(message);
    setAuthError(null);
    loadJobsAndStatuses();
  }

  async function handlePasskey() {
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess('Finish signing in in the tab that just opened.');
    try {
      const token = await launchPasskeyAuthBridge();
      if (!token) {
        setAuthError('Sign-in was not completed.');
        setAuthSuccess(null);
        return;
      }
      const me = await fetchMe();
      await finishLogin(me.dbUser, `Welcome back, ${me.dbUser.name}.`);
    } catch (error) {
      setAuthError(errorMessage(error, 'Passkey sign-in failed.'));
      setAuthSuccess(null);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleMagicLinkRequest(email: string) {
    if (!email.trim()) {
      setAuthError('Enter your work email.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      const res = await requestMagicLink(email);
      setMagicSent(true);
      setAuthSuccess(res.message || 'Check your inbox for the sign-in link, or paste the code below.');
    } catch (error) {
      setAuthError(errorMessage(error, 'Could not send the magic link.'));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleMagicLinkVerify(code: string) {
    if (!code.trim()) {
      setAuthError('Paste the sign-in code.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await verifyMagicLink(code);
      await finishLogin(res.user);
    } catch (error) {
      setAuthError(errorMessage(error, 'That code is invalid or has expired.'));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handlePasswordLogin(email: string, password: string) {
    if (!email.trim() || !password) {
      setAuthError('Email and password are required.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await loginWithPassword(email, password);
      await finishLogin(res.user);
    } catch (error) {
      setAuthError(errorMessage(error, 'Invalid email or password.'));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    await clearAuthSession();
    setCurrentUser(null);
    setAuthSuccess(null);
    setAuthError(null);
    setMagicSent(false);
  }

  /* ─── Candidate ─────────────────────────────────────────────────────────── */

  function updateProfile(profile: ParsedCandidateProfile) {
    setPhase((current) => (current.kind === 'ready' ? { ...current, profile, dirty: true } : current));
  }

  async function handleFetchContact() {
    if (phaseRef.current.kind !== 'ready') return;
    const tab = await activeTab();
    if (!tab?.id) return;
    busy.current = true;
    setContact({ status: 'loading' });
    try {
      const result = await fetchContactFromTab(tab.id);
      setPhase((current) => {
        if (current.kind !== 'ready') return current;
        const info = result.contact;
        const profile = info
          ? {
              ...current.profile,
              email: current.profile.email || info.email,
              phone: current.profile.phone || info.phone,
              websites: info.websites.length > 0 ? info.websites : current.profile.websites,
            }
          : current.profile;
        return { ...current, profile, trace: [...current.trace, ...result.trace] };
      });
      if (result.success) setContact({ status: 'done', found: Boolean(result.contact?.email || result.contact?.phone) });
      else setContact({ status: 'error', message: result.trace[result.trace.length - 1] ?? 'Could not read contact info.' });
    } catch (error) {
      setContact({ status: 'error', message: errorMessage(error, 'Could not reach the LinkedIn tab.') });
    } finally {
      busy.current = false;
    }
  }

  async function handleImport() {
    if (phase.kind !== 'ready') return;
    const { profile, duplicate } = phase;
    if (!profile.full_name.trim()) {
      setImportError('A name is required.');
      return;
    }
    setImporting(true);
    setImportError(null);
    setImportSuccess(null);
    const job = jobs.find((entry) => entry.job_id === selectedJobId);
    try {
      const result = await importCandidateToCRM({
        full_name: profile.full_name.trim(),
        headline: profile.headline,
        current_title: profile.current_title,
        current_company: profile.current_company,
        location: profile.location,
        linkedin_url: profile.linkedin_url,
        skills: profile.skills,
        email: profile.email || undefined,
        phone: profile.phone || undefined,
        job_id: selectedJobId || undefined,
        company_id: job?.company_id || undefined,
        status_id: selectedStatusId || undefined,
        notes: notes || undefined,
        existing_person_id: duplicate.person?.person_id || undefined,
      });
      setImportSuccess(duplicate.isDuplicate ? `Updated ${profile.full_name}.` : `Imported ${profile.full_name} into Prosperity.`);
      setNotes('');
      if (!duplicate.isDuplicate && result?.personId) {
        setPhase((current) =>
          current.kind === 'ready'
            ? { ...current, duplicate: { isDuplicate: true, person: { person_id: result.personId!, full_name: profile.full_name } } }
            : current,
        );
      }
    } catch (error) {
      setImportError(errorMessage(error, 'Could not save the candidate.'));
    } finally {
      setImporting(false);
    }
  }

  /* ─── Render ────────────────────────────────────────────────────────────── */

  const refreshing = phase.kind === 'extracting';
  const footer =
    currentUser && phase.kind === 'ready' ? (
      <Button variant="primary" className="w-full" onClick={handleImport} disabled={importing}>
        {importing
          ? phase.duplicate.isDuplicate
            ? 'Updating…'
            : 'Importing…'
          : phase.duplicate.isDuplicate
            ? 'Update in Prosperity'
            : 'Import to Prosperity'}
      </Button>
    ) : undefined;

  return (
    <Shell
      theme={theme}
      onToggleTheme={toggleTheme}
      user={currentUser}
      onLogout={handleLogout}
      onRefresh={() => inspectActiveTab(true)}
      refreshing={refreshing}
      footer={footer}
    >
      {loadingUser ? (
        <LoadingState label="Checking your session…" />
      ) : !currentUser ? (
        <AuthScreen
          loading={authLoading}
          error={authError}
          success={authSuccess}
          magicSent={magicSent}
          onPasskey={handlePasskey}
          onMagicLinkRequest={handleMagicLinkRequest}
          onMagicLinkVerify={handleMagicLinkVerify}
          onPasswordLogin={handlePasswordLogin}
          onBackFromMagic={() => {
            setMagicSent(false);
            setAuthSuccess(null);
          }}
        />
      ) : phase.kind === 'idle' ? (
        <EmptyState onRefresh={() => inspectActiveTab(true)} />
      ) : phase.kind === 'extracting' ? (
        <LoadingState label="Reading the profile…" />
      ) : phase.kind === 'failed' ? (
        <FailureState onRetry={() => inspectActiveTab(true)} trace={phase.trace} />
      ) : (
        <CandidatePanel
          profile={phase.profile}
          onChange={updateProfile}
          duplicate={phase.duplicate}
          webAppUrl={WEB_APP_URL}
          jobs={jobs}
          statuses={statuses}
          selectedJobId={selectedJobId}
          onSelectJob={setSelectedJobId}
          selectedStatusId={selectedStatusId}
          onSelectStatus={setSelectedStatusId}
          notes={notes}
          onNotesChange={setNotes}
          contact={contact}
          onFetchContact={handleFetchContact}
          importing={importing}
          importSuccess={importSuccess}
          importError={importError}
          trace={phase.trace}
        />
      )}
    </Shell>
  );
}
