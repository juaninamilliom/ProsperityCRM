/**
 * `sidepanel.html?preview=<state>` renders one panel state with fixture data
 * and no Chrome APIs, so the panel can be opened in a plain browser tab (or a
 * headless one) to check the design. States: login, empty, loading, failed,
 * candidate, duplicate.
 */
import { useState } from 'react';
import type { ParsedCandidateProfile } from '../content/linkedin-parser';
import { AuthScreen } from './AuthScreen';
import { CandidatePanel, type ContactState } from './CandidatePanel';
import { EmptyState, FailureState, LoadingState, Shell } from './Shell';
import { useTheme } from './theme';
import { Button } from './ui';

const USER = { user_id: 'u1', name: 'Juan Guardado', email: 'juan@prosperity.test', role: 'OrgAdmin', organization_id: 'o1' };

const PROFILE: ParsedCandidateProfile = {
  full_name: 'Nadia Brooks',
  headline: 'VP Engineering at Meridian · ex-Stripe',
  current_title: 'VP Engineering',
  current_company: 'Meridian',
  location: 'Austin, Texas, United States',
  linkedin_url: 'https://www.linkedin.com/in/nadiabrooks',
  avatar_url: null,
  about: null,
  skills: ['Go', 'Kubernetes', 'Postgres', 'Distributed Systems', 'Engineering Management', 'Hiring'],
  email: null,
  phone: null,
  websites: [],
  role_current: true,
};

const JOBS = [
  { job_id: 'j1', title: 'Senior Backend Engineer', status: 'open', company_id: 'c1', company_name: 'Meridian' },
  { job_id: 'j2', title: 'Head of Platform', status: 'open', company_id: 'c2', company_name: 'Northwind' },
];

const STATUSES = [
  { status_id: 's1', name: 'Sourced', order_index: 0 },
  { status_id: 's2', name: 'Screening', order_index: 1 },
  { status_id: 's3', name: 'Interviewing', order_index: 2 },
];

const TRACE = [
  'URL https://www.linkedin.com/in/nadiabrooks/ → slug "nadiabrooks"',
  'Name "Nadia Brooks" (main section h1)',
  'Headline "VP Engineering at Meridian · ex-Stripe"',
  'Location "Austin, Texas, United States"',
  'Company "Meridian" (top-card "Current company" badge)',
  'Experience: "VP Engineering" at "Meridian"',
  'Contact info lives in the "Contact info" overlay; not open - use "Fetch contact info"',
  '6 skills',
  'Result: "Nadia Brooks" - VP Engineering at Meridian',
];

export function Preview({ state }: { state: string }) {
  const [theme, toggleTheme] = useTheme();
  const [profile, setProfile] = useState(PROFILE);
  const [jobId, setJobId] = useState('j1');
  const [statusId, setStatusId] = useState('s1');
  const [notes, setNotes] = useState('');
  const contact: ContactState = state === 'duplicate' ? { status: 'done', found: false } : { status: 'idle' };
  const noop = () => {};

  const duplicate =
    state === 'duplicate'
      ? { isDuplicate: true, person: { person_id: 'p1', full_name: 'Nadia Brooks', email: 'nadia@meridian.io' } }
      : { isDuplicate: false };

  const loggedIn = state !== 'login';
  const footer =
    state === 'candidate' || state === 'duplicate' ? (
      <Button variant="primary" className="w-full">
        {state === 'duplicate' ? 'Update in Prosperity' : 'Import to Prosperity'}
      </Button>
    ) : undefined;

  return (
    <Shell theme={theme} onToggleTheme={toggleTheme} user={loggedIn ? USER : null} onLogout={noop} onRefresh={noop} footer={footer}>
      {state === 'login' && (
        <AuthScreen
          loading={false}
          error={null}
          success={null}
          magicSent={false}
          onPasskey={noop}
          onMagicLinkRequest={noop}
          onMagicLinkVerify={noop}
          onPasswordLogin={noop}
          onBackFromMagic={noop}
        />
      )}
      {state === 'empty' && <EmptyState onRefresh={noop} />}
      {state === 'loading' && <LoadingState label="Reading the profile…" />}
      {state === 'failed' && <FailureState onRetry={noop} trace={TRACE.slice(0, 3)} />}
      {(state === 'candidate' || state === 'duplicate') && (
        <CandidatePanel
          profile={state === 'duplicate' ? { ...profile, email: 'nadia@meridian.io', websites: ['https://nadia.dev/'] } : profile}
          onChange={setProfile}
          duplicate={duplicate}
          webAppUrl="https://prosperity-crm-web.vercel.app"
          jobs={JOBS}
          statuses={STATUSES}
          selectedJobId={jobId}
          onSelectJob={setJobId}
          selectedStatusId={statusId}
          onSelectStatus={setStatusId}
          notes={notes}
          onNotesChange={setNotes}
          contact={contact}
          onFetchContact={noop}
          importing={false}
          importSuccess={null}
          importError={null}
          trace={TRACE}
        />
      )}
    </Shell>
  );
}
