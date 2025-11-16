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

export interface TargetAgency {
  agency_id: string;
  name: string;
  contact_email: string | null;
  created_at: string;
}

export interface StatusConfig {
  status_id: string;
  name: string;
  order_index: number;
  is_terminal: boolean;
  created_at: string;
}

export interface Candidate {
  candidate_id: string;
  name: string;
  email: string;
  phone: string | null;
  current_status_id: string;
  target_agency_id: string;
  recruiter_id: string;
  flags: string[];
  skills: string[];
  notes: string | null;
  created_at: string;
}

export interface CandidateStatusHistory {
  history_id: string;
  candidate_id: string;
  from_status_id: string | null;
  to_status_id: string;
  change_date: string;
  changed_by: string;
}

export interface OrganizationSkill {
  skill_id: string;
  organization_id: string;
  name: string;
  created_at: string;
}
