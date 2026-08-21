export type UUID = string;

export interface User {
  user_id: UUID;
  email: string;
  name: string;
  role: 'OrgAdmin' | 'OrgEmployee';
  sso_id: string | null;
  password?: string | null;
  organization_id: UUID;
  is_active: boolean;
  created_at: string;
}

export interface Organization {
  organization_id: UUID;
  name: string;
  slug: string;
  created_at: string;
}

export interface JobRequisition {
  job_id: UUID;
  company_id: UUID | null;
  opportunity_id: UUID | null;
  title: string;
  department: string | null;
  location: string | null;
  status: string;
  description: string | null;
  created_at: string;
}

export interface JobRequisitionWithStats extends JobRequisition {
  total_entries: number;
  placements: number;
}

export interface StatusConfig {
  status_id: UUID;
  name: string;
  order_index: number;
  is_terminal: boolean;
  created_at: string;
}

export interface OrganizationSkill {
  skill_id: UUID;
  organization_id: UUID;
  name: string;
  created_at: string;
}

export type Relationship = 'prospect' | 'client' | 'former' | 'do_not_contact';
export type OpportunityStage =
  | 'prospect' | 'contacted' | 'meeting' | 'proposal' | 'negotiation' | 'signed' | 'lost';
export type ContactRole = 'champion' | 'decision_maker' | 'influencer' | 'blocker' | 'intro';
export type Channel =
  | 'li_message' | 'li_inmail' | 'li_connect' | 'email' | 'call' | 'meeting' | 'note';
export type Direction = 'outbound' | 'inbound' | 'internal';
export type PersonSource = 'manual' | 'linkedin_capture' | 'import';

export interface Company {
  company_id: UUID;
  organization_id: UUID;
  name: string;
  linkedin_url: string | null;
  domain: string | null;
  industry: string | null;
  headcount: string | null;
  location: string | null;
  relationship: Relationship;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
}

export interface Person {
  person_id: UUID;
  organization_id: UUID;
  full_name: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  headline: string | null;
  location: string | null;
  current_company_id: UUID | null;
  current_title: string | null;
  skills: string[];
  notes: string | null;
  source: PersonSource;
  created_at: string;
}

export interface PipelineEntry {
  entry_id: UUID;
  organization_id: UUID;
  person_id: UUID;
  company_id: UUID;
  job_id: UUID | null;
  current_status_id: UUID;
  recruiter_id: UUID;
  flags: string[];
  notes: string | null;
  created_at: string;
}

export interface BdOpportunity {
  opportunity_id: UUID;
  organization_id: UUID;
  company_id: UUID;
  name: string;
  stage: OpportunityStage;
  /** Postgres numeric arrives over the wire as a string. Never render raw. */
  fee_percent: string | number | null;
  est_annual_value: string | number | null;
  expected_close: string | null;
  owner_id: UUID | null;
  lost_reason: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface Activity {
  activity_id: UUID;
  organization_id: UUID;
  person_id: UUID | null;
  company_id: UUID | null;
  opportunity_id: UUID | null;
  entry_id: UUID | null;
  channel: Channel;
  direction: Direction;
  occurred_at: string;
  subject: string | null;
  body: string | null;
  created_by: UUID | null;
}

export interface EntryStatusHistory {
  history_id: UUID;
  entry_id: UUID;
  from_status_id: UUID | null;
  to_status_id: UUID;
  change_date: string;
  changed_by: UUID | null;
}
