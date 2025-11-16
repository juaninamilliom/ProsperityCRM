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

export interface TargetAgency {
  agency_id: UUID;
  name: string;
  contact_email: string | null;
  created_at: string;
}

export interface JobRequisition {
  job_id: UUID;
  title: string;
  department: string | null;
  location: string | null;
  status: string;
  description: string | null;
  created_at: string;
}

export interface JobRequisitionWithStats extends JobRequisition {
  total_candidates: number;
  placements: number;
}

export interface StatusConfig {
  status_id: UUID;
  name: string;
  order_index: number;
  is_terminal: boolean;
  created_at: string;
}

export interface Candidate {
  candidate_id: UUID;
  name: string;
  email: string;
  phone: string | null;
  current_status_id: UUID;
  target_agency_id: UUID;
  recruiter_id: UUID;
  job_requisition_id: UUID | null;
  flags: string[];
  notes: string | null;
  created_at: string;
}

export interface CandidateStatusHistory {
  history_id: UUID;
  candidate_id: UUID;
  from_status_id: UUID | null;
  to_status_id: UUID;
  change_date: string;
  changed_by: UUID;
}
