export type Role = 'OrgAdmin' | 'OrgEmployee';

export interface UserDTO {
  user_id: string;
  email: string;
  name: string;
  role: Role;
  sso_id?: string | null;
  organization_id: string;
  is_active?: boolean;
}

export interface StatusDTO {
  status_id: string;
  name: string;
  order_index: number;
  is_terminal: boolean;
}

export interface JobRequisitionDTO {
  job_id: string;
  title: string;
  department?: string | null;
  location?: string | null;
  status: 'open' | 'on_hold' | 'closed';
  description?: string | null;
  close_date?: string | null;
  deal_amount?: number | null;
  weighted_deal_amount?: number | null;
  owner_name?: string | null;
  stage?: string | null;
  company_id?: string | null;
  opportunity_id?: string | null;
  company_name?: string | null;
  total_entries?: number;
}

export interface JobDetailDTO extends JobRequisitionDTO {
  total_entries: number;
  placements: number;
}

export interface JobDealSplitDTO {
  split_id: string;
  teammate_name: string;
  teammate_status?: string | null;
  role?: 'lead' | 'secondary' | null;
  split_percent: number;
  total_deal?: number | null;
  weighted_deal?: number | null;
}

export interface OrganizationDTO {
  organization_id: string;
  name: string;
  slug: string;
}

export interface OrganizationSkillDTO {
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

export interface CompanyDTO {
  company_id: string;
  name: string;
  linkedin_url?: string | null;
  domain?: string | null;
  industry?: string | null;
  headcount?: string | null;
  location?: string | null;
  relationship: Relationship;
  contact_email?: string | null;
  notes?: string | null;
  /** Derived by the list query - present on /companies, absent on a detail fetch. */
  contact_count?: number;
  open_deals?: number;
  open_reqs?: number;
  last_touch?: string | null;
}

export interface PersonDTO {
  person_id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  headline?: string | null;
  location?: string | null;
  current_company_id?: string | null;
  current_title?: string | null;
  skills: string[];
  notes?: string | null;
  source?: 'manual' | 'linkedin_capture' | 'import';
  company_name?: string | null;
  entry_count?: number;
  deal_count?: number;
  last_touch?: string | null;
}

export interface OpportunityContactDTO {
  person_id: string;
  full_name: string;
  role: ContactRole | null;
}

export interface OpportunityDTO {
  opportunity_id: string;
  company_id: string;
  name: string;
  stage: OpportunityStage;
  /** Postgres numeric arrives as a string. Always run it through formatMoney. */
  fee_percent?: string | number | null;
  est_annual_value?: string | number | null;
  expected_close?: string | null;
  owner_id?: string | null;
  lost_reason?: string | null;
  closed_at?: string | null;
  company_name?: string;
  relationship?: Relationship;
  contacts?: OpportunityContactDTO[];
  last_touch?: string | null;
}

export interface ActivityDTO {
  activity_id: string;
  person_id?: string | null;
  company_id?: string | null;
  opportunity_id?: string | null;
  entry_id?: string | null;
  channel: Channel;
  direction: Direction;
  occurred_at: string;
  subject?: string | null;
  body?: string | null;
  person_name?: string | null;
  company_name?: string | null;
  opportunity_name?: string | null;
}

export interface PipelineEntryDTO {
  entry_id: string;
  person_id: string;
  company_id: string;
  job_id?: string | null;
  current_status_id: string;
  recruiter_id: string;
  flags: string[];
  notes?: string | null;
}

/** The board card shows the person, so the person is joined onto the entry:
 *  full_name and skills describe the human, flags describe this pitch. */
export interface PipelineEntryWithMeta extends PipelineEntryDTO {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  skills: string[];
  status_name?: string;
  order_index?: number;
  company_name?: string;
  job_title?: string | null;
  job_status?: string | null;
  is_terminal?: boolean;
}

/** What GET /companies/:id and GET /people/:id return - each detail screen
 *  needs several related collections, fetched in one round trip. */
export interface CompanyDetailDTO extends CompanyDTO {
  contacts: (PersonDTO & { role: ContactRole | null })[];
  deals: OpportunityDTO[];
  requisitions: (JobRequisitionDTO & { entry_count: number })[];
  activity: ActivityDTO[];
}

export interface PersonDetailDTO extends PersonDTO {
  entries: PipelineEntryWithMeta[];
  deals: (OpportunityDTO & { role: ContactRole | null; company_name: string })[];
  activity: ActivityDTO[];
}
