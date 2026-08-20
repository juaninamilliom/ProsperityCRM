import { useState } from 'react';
import { Card, SectionLabel } from '../components/ui';

const SETUP = [
  {
    title: 'Add your agencies',
    body: 'Settings → Agencies. Every candidate is tied to the agency you are placing them through, so add these before you add people.',
  },
  {
    title: 'Shape your stages',
    body: 'Settings → Pipeline stages. These become the columns on your board. Mark a stage terminal when it takes a candidate out of the active pipeline, like Placed or Rejected.',
  },
  {
    title: 'Create job requisitions',
    body: 'Settings → Jobs. A requisition carries the deal value and the split, so the Jobs page can show you what your pipeline is actually worth.',
  },
  {
    title: 'Add your team',
    body: 'Settings → Members lists everyone in your organisation, and an admin can change anyone’s role there. New teammates sign up with your organisation ID.',
  },
];

/** Verified against the API: invite codes have list/create/revoke endpoints and
 *  nothing that redeems them, and /auth/signup takes organization_id + a
 *  self-chosen role with no code field. Saying otherwise in the guide would
 *  tell admins they have gated something they have not. */
const ONBOARDING_CAVEAT =
  'Invite codes can be generated and revoked, but sign-up does not require one yet — anyone with your organisation ID can create an account and choose their own role. Until that is wired up, treat your organisation ID as sensitive.';

const TIPS = [
  'Drag a card between columns to change stage. The move is recorded in that candidate’s history with who made it and when.',
  'Click any card to open the detail rail without leaving the board — contact details, skills, and where they sit in the process.',
  'Search matches a candidate’s name, email, or the title of the job they are attached to.',
  'Use Filters to narrow by agency, job, stage, flag or skill. The badge on the button tells you how many filters are active.',
  'Switch to List view when you want to scan everyone at once rather than by stage.',
  'Open a candidate and choose Open to edit their details, skills, flags and notes.',
];

const TAGGING = [
  {
    title: 'Skills are shared',
    body: 'The skill library belongs to the whole organisation. Adding a skill on one candidate makes it available to everyone, so prefer picking an existing skill over typing a near-duplicate.',
  },
  {
    title: 'Flags are free text',
    body: 'Flags are short labels you invent — Counter-offer risk, Referral, Needs visa. They are filterable, so keep the wording consistent across candidates.',
  },
];

const JOBS = [
  {
    title: 'Deal value and weighted value',
    body: 'Each requisition carries a deal amount and a probability-adjusted weighted amount. The Jobs page totals both across open roles so you can see what the pipeline is worth.',
  },
  {
    title: 'Splits',
    body: 'A deal sheet records who shares the fee and by what percentage — useful when a sourcer and an account manager both worked a placement.',
  },
  {
    title: 'Status',
    body: 'A job is Open, On hold, or Closed. Only open roles count towards the pipeline totals on the Jobs page.',
  },
];

const ROLES = [
  {
    name: 'Org Admin',
    can: [
      'Everything a recruiter can do',
      'Add and edit agencies, jobs and pipeline stages',
      'Change teammates’ roles',
      'Generate and revoke invite codes',
    ],
  },
  {
    name: 'Recruiter',
    can: [
      'Add, edit and move candidates',
      'Add skills to the shared library',
      'Add flags and notes',
      'View jobs and deal sheets',
    ],
  },
];

const SECTIONS = [
  { id: 'setup', label: 'Build your workspace' },
  { id: 'pipeline', label: 'Working the pipeline' },
  { id: 'tagging', label: 'Skills and flags' },
  { id: 'jobs', label: 'Jobs and deal sheets' },
  { id: 'roles', label: 'Who can do what' },
  { id: 'help', label: 'Getting help' },
];

function Check({ className = '' }: { className?: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

export function UserGuidePage() {
  const [active, setActive] = useState('setup');

  return (
    <div className="flex gap-10">
      <nav className="sticky top-0 hidden w-[208px] shrink-0 flex-col gap-1.5 self-start pt-[86px] lg:flex">
        <span className="px-2.5 pb-1.5">
          <SectionLabel>On this page</SectionLabel>
        </span>
        {SECTIONS.map((section) => {
          const on = section.id === active;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              onClick={() => setActive(section.id)}
              className={[
                'focus-ring flex h-8 items-center gap-2.5 rounded-[8px] px-2.5 text-sm transition',
                on ? 'bg-surface-3 font-semibold text-ink' : 'text-ink-2 hover:bg-surface-3',
              ].join(' ')}
            >
              <span
                aria-hidden
                className="h-[5px] w-[5px] shrink-0 rounded-full"
                style={{ background: on ? 'var(--accent)' : 'transparent' }}
              />
              {section.label}
            </a>
          );
        })}
      </nav>

      <div className="flex min-w-0 max-w-[720px] flex-1 flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-display">User guide</h1>
          <p className="text-base text-ink-2">
            Everything you need to run Prosperity day to day. Takes about five minutes to read.
          </p>
        </div>

        <Card as="section" id="setup" className="flex scroll-mt-8 flex-col gap-[18px] p-[26px]">
          <div className="flex flex-col gap-1">
            <SectionLabel>Getting started</SectionLabel>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Build your workspace</h2>
          </div>
          <ol className="flex flex-col gap-4">
            {SETUP.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink">
                  {index + 1}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13.5px] font-semibold">{step.title}</span>
                  <span className="text-[13.5px] leading-relaxed text-ink-2 [text-wrap:pretty]">
                    {step.body}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <p className="flex items-start gap-3 rounded-[11px] bg-warn-bg px-4 py-3.5 text-base leading-relaxed text-warn-fg [text-wrap:pretty]">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            >
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            </svg>
            {ONBOARDING_CAVEAT}
          </p>
        </Card>

        <Card as="section" id="pipeline" className="flex scroll-mt-8 flex-col gap-[18px] p-[26px]">
          <div className="flex flex-col gap-1">
            <SectionLabel>Day to day</SectionLabel>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Working the pipeline</h2>
          </div>
          <p className="text-[13.5px] leading-relaxed text-ink-2 [text-wrap:pretty]">
            The board is the centre of the app. Each column is a stage; drag a candidate between
            columns to move them, and every move is written to their history so you can see how a
            placement actually progressed.
          </p>
          <ul className="flex flex-col gap-2.5">
            {TIPS.map((tip) => (
              <li
                key={tip}
                className="flex items-start gap-3 rounded-[11px] bg-surface-2 px-4 py-3.5"
              >
                <Check className="mt-0.5 shrink-0 text-accent" />
                <span className="text-base leading-relaxed text-ink-2 [text-wrap:pretty]">
                  {tip}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card as="section" id="tagging" className="flex scroll-mt-8 flex-col gap-[18px] p-[26px]">
          <div className="flex flex-col gap-1">
            <SectionLabel>Organising people</SectionLabel>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Skills and flags</h2>
          </div>
          <div className="flex flex-col gap-4">
            {TAGGING.map((item) => (
              <div key={item.title} className="flex flex-col gap-0.5">
                <span className="text-[13.5px] font-semibold">{item.title}</span>
                <span className="text-[13.5px] leading-relaxed text-ink-2 [text-wrap:pretty]">
                  {item.body}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card as="section" id="jobs" className="flex scroll-mt-8 flex-col gap-[18px] p-[26px]">
          <div className="flex flex-col gap-1">
            <SectionLabel>Money</SectionLabel>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Jobs and deal sheets</h2>
          </div>
          <div className="flex flex-col gap-4">
            {JOBS.map((item) => (
              <div key={item.title} className="flex flex-col gap-0.5">
                <span className="text-[13.5px] font-semibold">{item.title}</span>
                <span className="text-[13.5px] leading-relaxed text-ink-2 [text-wrap:pretty]">
                  {item.body}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card as="section" id="roles" className="flex scroll-mt-8 flex-col gap-[18px] p-[26px]">
          <div className="flex flex-col gap-1">
            <SectionLabel>Permissions</SectionLabel>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Who can do what</h2>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {ROLES.map((role) => (
              <div
                key={role.name}
                className="flex flex-col gap-2.5 rounded-[12px] border border-border p-[18px]"
              >
                <span className="self-start rounded-chip bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-ink">
                  {role.name}
                </span>
                <ul className="flex flex-col gap-1.5">
                  {role.can.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-ink-2">
                      <Check className="mt-0.5 h-[13px] w-[13px] shrink-0 text-ink-3" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        <section
          id="help"
          className="flex scroll-mt-8 items-center justify-between gap-5 rounded-card border border-dashed border-border bg-surface-2 px-[26px] py-[22px]"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-[13.5px] font-semibold">Still stuck?</span>
            <span className="text-sm text-ink-2">
              Ask your org admin, or reach the team at [YOUR SUPPORT EMAIL].
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
