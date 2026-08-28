import type { ParsedCandidateProfile } from '../content/linkedin-parser';
import type { CandidateDuplicateResult, JobRequisition, StatusConfig } from './api';
import { TracePanel } from './Shell';
import { Avatar, Button, Card, Chip, Field, Icon, Notice, SectionLabel, Select, Spinner } from './ui';

export type ContactState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; found: boolean }
  | { status: 'error'; message: string };

export interface CandidatePanelProps {
  profile: ParsedCandidateProfile;
  onChange: (profile: ParsedCandidateProfile) => void;
  duplicate: CandidateDuplicateResult;
  webAppUrl: string;
  jobs: JobRequisition[];
  statuses: StatusConfig[];
  selectedJobId: string;
  onSelectJob: (jobId: string) => void;
  selectedStatusId: string;
  onSelectStatus: (statusId: string) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  contact: ContactState;
  onFetchContact: () => void;
  importing: boolean;
  importSuccess: string | null;
  importError: string | null;
  trace: string[];
}

function subtitle(profile: ParsedCandidateProfile) {
  return [profile.current_title, profile.current_company].filter(Boolean).join(' · ');
}

export function CandidatePanel(props: CandidatePanelProps) {
  const { profile, onChange, duplicate, contact } = props;
  const set = <K extends keyof ParsedCandidateProfile>(key: K) => (value: ParsedCandidateProfile[K]) =>
    onChange({ ...profile, [key]: value });

  return (
    <div className="flex flex-col gap-4">
      {duplicate.isDuplicate ? (
        <Notice tone="ok">
          <span className="mt-[5px] h-2 w-2 shrink-0 rounded-full bg-ok-dot" />
          <span className="flex-1 font-medium">Already in Prosperity</span>
          {duplicate.person?.person_id && (
            <a
              href={`${props.webAppUrl}/people/${duplicate.person.person_id}`}
              target="_blank"
              rel="noreferrer"
              className="focus-ring inline-flex items-center gap-1 rounded-[4px] font-medium underline-offset-2 hover:underline"
            >
              Open in CRM
              <Icon name="external" size={12} />
            </a>
          )}
        </Notice>
      ) : (
        <Notice tone="accent">
          <span className="mt-[5px] h-2 w-2 shrink-0 rounded-full bg-accent" />
          <span className="font-medium">New candidate - not in Prosperity yet</span>
        </Notice>
      )}

      <Card className="flex flex-col gap-4.5 p-4 shadow-token">
        <div className="flex items-center gap-3">
          <Avatar name={profile.full_name} src={profile.avatar_url} size={40} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-lg font-semibold tracking-[-0.01em]">{profile.full_name || 'Unnamed candidate'}</span>
            <span className="truncate text-sm text-ink-2">{subtitle(profile) || profile.headline || 'No role captured'}</span>
          </div>
        </div>

        {profile.role_current === false && (
          <Notice tone="off">
            <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
            <span>The top role on this profile has ended - check title and company.</span>
          </Notice>
        )}
        {(profile.role_source === 'headline' || profile.role_source === 'voyager' || profile.role_source === 'json-ld') && (
          <Notice tone="warn">
            <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
            <span>
              Title and company are guessed from the headline - the Experience section had not rendered. Re-read the page
              (↻ above) once it has.
            </span>
          </Notice>
        )}

        <div className="flex flex-col gap-4">
          <Field label="Full name" value={profile.full_name} onChange={(e) => set('full_name')(e.target.value)} placeholder="Nadia Brooks" />
          <Field label="Headline" value={profile.headline} onChange={(e) => set('headline')(e.target.value)} placeholder="VP Engineering at Meridian" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Current title" value={profile.current_title} onChange={(e) => set('current_title')(e.target.value)} placeholder="VP Engineering" />
            <Field label="Current company" value={profile.current_company} onChange={(e) => set('current_company')(e.target.value)} placeholder="Meridian" />
          </div>
          <Field label="Location" value={profile.location} onChange={(e) => set('location')(e.target.value)} placeholder="Austin, TX" />
          <Field
            label="LinkedIn"
            hint={
              profile.linkedin_url ? (
                <a
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring inline-flex items-center gap-1 rounded-[4px] text-accent underline-offset-2 hover:underline"
                >
                  Open
                  <Icon name="external" size={11} />
                </a>
              ) : undefined
            }
            value={profile.linkedin_url}
            onChange={(e) => set('linkedin_url')(e.target.value)}
            placeholder="linkedin.com/in/nadiabrooks"
          />
        </div>

        {profile.skills.length > 0 && (
          <div className="flex flex-col gap-2">
            <SectionLabel>Skills</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {profile.skills.slice(0, 12).map((skill) => (
                <Chip key={skill} tone="accent" size="sm">
                  {skill}
                </Chip>
              ))}
              {profile.skills.length > 12 && (
                <Chip tone="neutral" size="sm">
                  +{profile.skills.length - 12} more
                </Chip>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-4 p-4 shadow-token">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>Contact</SectionLabel>
          <Button size="sm" onClick={props.onFetchContact} disabled={contact.status === 'loading'} className="h-7 px-2.5 text-xs">
            {contact.status === 'loading' ? <Spinner size={12} /> : <Icon name="mail" size={13} />}
            {contact.status === 'loading' ? 'Reading…' : 'Fetch contact info'}
          </Button>
        </div>

        {contact.status === 'done' && !contact.found && (
          <Notice tone="off">
            <span>This person shares no email or phone on LinkedIn.</span>
          </Notice>
        )}
        {contact.status === 'error' && (
          <Notice tone="warn">
            <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
            <span>{contact.message}</span>
          </Notice>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" type="email" hint="Optional" value={profile.email ?? ''} onChange={(e) => set('email')(e.target.value || null)} placeholder="nadia@example.com" />
          <Field label="Phone" value={profile.phone ?? ''} onChange={(e) => set('phone')(e.target.value || null)} placeholder="555-0101" />
        </div>

        {profile.websites.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <SectionLabel>Websites</SectionLabel>
            {profile.websites.map((site) => (
              <a
                key={site}
                href={site}
                target="_blank"
                rel="noreferrer"
                className="focus-ring truncate rounded-[4px] text-sm text-accent underline-offset-2 hover:underline"
              >
                {site.replace(/^https?:\/\//, '')}
              </a>
            ))}
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-4 p-4 shadow-token">
        <SectionLabel>Pipeline</SectionLabel>
        <Select label="Job requisition" value={props.selectedJobId} onChange={(e) => props.onSelectJob(e.target.value)}>
          <option value="">None - save to People only</option>
          {props.jobs.map((job) => (
            <option key={job.job_id} value={job.job_id}>
              {job.title}
              {job.company_name ? ` · ${job.company_name}` : ''}
            </option>
          ))}
        </Select>
        {props.selectedJobId && (
          <Select label="Starting stage" value={props.selectedStatusId} onChange={(e) => props.onSelectStatus(e.target.value)}>
            {props.statuses.map((status) => (
              <option key={status.status_id} value={status.status_id}>
                {status.name}
              </option>
            ))}
          </Select>
        )}
        <Field
          as="textarea"
          label="Sourcing note"
          hint="Logged as an activity"
          value={props.notes}
          onChange={(e) => props.onNotesChange(e.target.value)}
          placeholder="Why this person, how you found them, fit for the role…"
        />

        {props.importSuccess && (
          <Notice tone="ok">
            <Icon name="check" size={14} className="mt-0.5 shrink-0" />
            <span>{props.importSuccess}</span>
          </Notice>
        )}
        {props.importError && (
          <Notice tone="warn">
            <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
            <span>{props.importError}</span>
          </Notice>
        )}
      </Card>

      <TracePanel trace={props.trace} />
    </div>
  );
}
