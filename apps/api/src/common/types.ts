export type Role = 'OrgAdmin' | 'OrgEmployee';

export interface User {
  user_id: string;
  email: string;
  name: string;
  role: Role;
  sso_id?: string | null;
  password?: string | null;
  organization_id: string;
  is_active: boolean;
  created_at: string;
}

export interface Organization {
  organization_id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface StatusConfig {
  status_id: string;
  name: string;
  order_index: number;
  is_terminal: boolean;
  created_at: string;
}

export interface OrganizationSkill {
  skill_id: string;
  organization_id: string;
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
  company_id: string;
  organization_id: string;
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
  person_id: string;
  organization_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  headline: string | null;
  location: string | null;
  current_company_id: string | null;
  current_title: string | null;
  skills: string[];
  notes: string | null;
  source: PersonSource;
  created_at: string;
}

export interface PipelineEntry {
  entry_id: string;
  organization_id: string;
  person_id: string;
  company_id: string;
  job_id: string | null;
  current_status_id: string;
  recruiter_id: string;
  flags: string[];
  notes: string | null;
  created_at: string;
}

export interface BdOpportunity {
  opportunity_id: string;
  organization_id: string;
  company_id: string;
  name: string;
  stage: OpportunityStage;
  /** Postgres numeric arrives over the wire as a string. Never render raw. */
  fee_percent: string | number | null;
  est_annual_value: string | number | null;
  expected_close: string | null;
  owner_id: string | null;
  lost_reason: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface Activity {
  activity_id: string;
  organization_id: string;
  person_id: string | null;
  company_id: string | null;
  opportunity_id: string | null;
  entry_id: string | null;
  channel: Channel;
  direction: Direction;
  occurred_at: string;
  subject: string | null;
  body: string | null;
  created_by: string | null;
}

export interface EntryStatusHistory {
  history_id: string;
  entry_id: string;
  from_status_id: string | null;
  to_status_id: string;
  change_date: string;
  changed_by: string | null;
}
